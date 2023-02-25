import {CodeCommand,evaluateSessionCmds,SessionOutputEvent} from "../session/sessionApi"
import CellInfo from "./CellInfo"
import {syntaxTree} from "@codemirror/language"
import {EditorView, Decoration} from "@codemirror/view"
import type { EditorState, Extension, ChangeSet, Range } from '@codemirror/state'
import { RangeSet, StateField, StateEffect } from '@codemirror/state'

//===================================
// Theme
//===================================

const baseTheme = EditorView.baseTheme({
    "&light .cm-rd-errText": {color: "red", fontWeight: "bold"},
    "&light .cm-rd-wrnText": {color: "orange", fontWeight: "bold"},
    "&light .cm-rd-msgText": {color: "blue"},
    "&dark .cm-rd-errText": {color: "red", fontWeight: "bold"},
    "&dark .cm-rd-wrnText": {color: "orange", fontWeight: "bold"},
    "&dark .cm-rd-msgText": {color: "lightblue"},

    "&light .cm-rd-codeDirtyShade": {backgroundColor: "rgba(200,226,255,0.5)"},
    "&light .cm-rd-valuePendingShade": {backgroundColor: "rgba(234,234,234,0.5)"},
    "&dark .cm-rd-codeDirtyShade": {backgroundColor: "rgba(52,26,0,0.5)"},
    "&dark .cm-rd-valuePendingShade": {backgroundColor: "rgba(31,31,31,0.5)"}
  })

//===================================
// Data Structures
//===================================


type DocState = {
    docVersion: number
    cellInfos: CellInfo[]
    decorations: RangeSet<Decoration>
}

enum Action {
    create,
    update,
    delete,
    remap,
    reuse
}


export type CellUpdateInfo = {
    action: Action
    cellInfo?: CellInfo
    newFrom?: number
    newTo?: number
    newFromLine?: number
    newToLine?: number
    codeText?: string
}

//==============================
// Sesssion Event Processing
//==============================

//SET THE TYPES TO SOMETHING BETTER THAN ANY
export const sessionOutputEffect = StateEffect.define<[SessionOutputEvent]>()

/** This function dispatches a document transaction for the given session event. */
export function sessionOutputToView(view: any, eventList: any) {
    if(view !== null) {
        let effects: StateEffect<any>[] = [sessionOutputEffect.of(eventList)]
        view.dispatch({effects: effects})
    }
}

//===============================
// Repdoc Codemirror Extension
//===============================

const ReactiveCodeField = StateField.define<DocState>({
    create(editorState) {
        return processDocChanges(editorState)
    },

    update(docState, transaction) {
        if(transaction.effects.length > 0) {
            docState = processSessionMessages(transaction.effects,docState)
        }

        if (transaction.docChanged) {
            docState = processDocChanges(transaction.state,transaction.changes,docState)
        }
        else {
            docState = processDocChanges(transaction.state,undefined,docState)
        }
        
        return docState
    },

    provide(docState) {
        return EditorView.decorations.from(docState, docState => docState.decorations)
    },
})

/** This is the extension to interface with the reactive code model and display the output in the editor */
export const repdoc = (): Extension => {
    return [
        baseTheme,
        ReactiveCodeField,
    ]
}

//===================================
// Internal Functions
//===================================

function createDocState(cellInfos: CellInfo[],docVersion: number): DocState {
    let decorations: Range<Decoration>[] = []
    if(cellInfos.length > 0) {
        cellInfos.forEach(cellInfo => cellInfo.pushDecorations(decorations))
    }

    return {
        docVersion: docVersion,
        cellInfos: cellInfos,
        decorations: (decorations.length > 0) ? 
            RangeSet.of(decorations) : Decoration.none
    }
}

//--------------------------
// Process Session Messages
//--------------------------

/** This function process session messages, which are passed in as transaction effects. 
 * It returns an updated docState. */
function processSessionMessages(effects: readonly StateEffect<any>[], docState: DocState) {

    //let sessionEventEffects = effects.filter(effect => effect.is(sessionEventEffect))

    for(let i1 = 0; i1 < effects.length; i1++) {
        let effect = effects[i1]
        if(effect.is(sessionOutputEffect)) { 
            let newCellInfos = docState.cellInfos.concat()

            for(let i2 = 0; i2 < effect.value.length; i2++) {
                //we are doing only one session for now
                let sessionOutputData = effect.value[i2] as SessionOutputEvent
                if(sessionOutputData.lineId !== null) {
                    let index = getCellInfoIndex(sessionOutputData.lineId,newCellInfos)
                    if(index >= 0) {
                        newCellInfos[index] = CellInfo.updateCellInfoDisplay(newCellInfos[index], sessionOutputData.data)

                        //============================================================================
                        //update when model code is set to doc code, on either eval start or end.

                        //once other cells are marked as input pending,
                        //clear cells following this one until:
                        // - we reach the next id
                        // - we reach a cell with an input version greater than this value version
                        //===============================================================================
                    }
                    else {
                        console.error("Session output received but line number not found: " + JSON.stringify(sessionOutputData))
                    }
                }
                else {
                    //figure out where we want to print this
                    printNonLineOutput(sessionOutputData)
                }
            }

            docState = createDocState(newCellInfos,docState.docVersion)
        }
    }
    return docState
}

function getCellInfoIndex(lineId: string, cellInfos: CellInfo[]) {
    return cellInfos.findIndex(cellInfo => cellInfo.id == lineId)
}

//fix the type here
function printNonLineOutput(sessionOutputData: any) {
    if(sessionOutputData.data.addedConsoleLines !== undefined) {
        let lines = sessionOutputData.data.addedConsoleLines
        for(let i = 0; i < lines.length; i++) {
            if(lines[i][0] == "stdout") {
                console.log(lines[i][1])
            }
            else {
                console.error(lines[i][1])
            }
        }
        //we'll ignore other stuff in there. it shouldn be there
    }
}

//--------------------------
// Process Document Changes
//--------------------------

/** This method processes document changes, returning an updated cell state. */
function processDocChanges(editorState: EditorState, changes: ChangeSet | undefined = undefined,  docState: DocState | undefined = undefined) {
    //increment version here for new document //CREATE A GOOD INITIAL VALUE - not 99
    let docVersion = (docState !== undefined) ? docState.docVersion + 1 : 99 

    //decide if we want to process the parser output
    let processParser = Math.random() > 0.5  //fill this in properly 

    //!!!!!!!!!!!!!!!!!!!!!!!!!
    //I need some additional info I think: which cells are ok for commands, was parse info used, other?

    let cellUpdateInfos: CellUpdateInfo[] | undefined = undefined
    let cellsToDelete: CellInfo[] | undefined = undefined
    let nonCommandIndex = 0

    //get cellUpdateInfos and cellsToDelete for remapped cells
    let {oldCellUpdateInfos, oldCellsToDelete} = getUpdateInfo(editorState, changes, docState)
    
    //process the parser output
    if(processParser) {
        let {newCellUpdateInfos, newCellsToDelete, parseErrorInfo} = updateLines(editorState, oldCellUpdateInfos, oldCellsToDelete)
        
        //these may be undefined, if we deicde no to use the parser
        cellUpdateInfos = newCellUpdateInfos
        cellsToDelete = newCellsToDelete 

        //!!!!!!!!!!!!!
        //If there is an active edit, this should be the index of the active edit
        nonCommandIndex = cellUpdateInfos !== undefined ? cellUpdateInfos.length : 0 

        //this is a dummy statemtnt to use the parse error info
        if(parseErrorInfo) console.log("Parser errror!")
    }

    if( cellUpdateInfos === undefined || cellsToDelete === undefined) {
        cellUpdateInfos = oldCellUpdateInfos
        cellsToDelete = oldCellsToDelete 
        nonCommandIndex = 0  //send no commands
    } 

    //send commands from this function?
    let cellInfos = createCellInfos(cellUpdateInfos,docVersion)

    //issue any necessary commands
    if(nonCommandIndex > 0) {
        cellInfos = issueSessionCommands(cellInfos,cellsToDelete,docVersion,nonCommandIndex)
    }
        
    //convert cellUpdateInfos(name?) to cell infos and doc staate
    return createDocState(cellInfos,docVersion)
}

function createCellInfos(cellUpdateInfos: CellUpdateInfo[],docVersion:number) {

    return cellUpdateInfos.map( cui => {
        switch(cui.action) {
            case Action.create: 
                return CellInfo.newCellInfo(cui.newFrom!,cui.newTo!,cui.newFromLine!,cui.newToLine!,cui.codeText!,docVersion) 

            case Action.update: 
                return CellInfo.updateCellInfoCode(cui.cellInfo!,cui.newFrom!,cui.newTo!,cui.newFromLine!,cui.newToLine!,cui.codeText!,docVersion) 

            case Action.remap: 
                return CellInfo.remapCellInfo(cui.cellInfo!,cui.newFrom!,cui.newTo!,cui.newFromLine!,cui.newToLine!)

            case Action.reuse: 
                return  cui.cellInfo!

            case Action.delete:
                throw new Error("Unexpected delete action")
        }
    })
}


/** This function gets update data for the cells from the previous state */
function getUpdateInfo(editorState: EditorState, changes?: ChangeSet, docState?: DocState) {
    let cellUpdateInfos: CellUpdateInfo[] = []
    let cellsToDelete: CellInfo[] = []

    let docText = editorState.doc

    //get the update info for each cell
    if((docState !== undefined)&&(changes !== undefined)) {
        let extendUpdateInfo: CellUpdateInfo | undefined = undefined

        docState!.cellInfos.forEach( (cellInfo) => {
            let doDelete = false
            let doUpdate = false
            let doRemap = false
            let doExtend = false

            //check effect of all text edits on this line
            changes!.iterChangedRanges( (fromOld,toOld,fromNew,toNew) => {
                if(fromOld < cellInfo.from) {
                    if(toOld < cellInfo.from) {
                        //before the start of this cell - we need to remap
                        doRemap = true
                    }
                    else {
                        //overlaps cell start and maybe the end - delete this cell

                        //note - if the used backspaced to an empty line, we want to keep this
                        doDelete = true
                    }
                }
                else if(fromOld <= cellInfo.to) {
                    //change starts in cell, ends inside or after - update cell
                    doUpdate = true
                    doRemap = true
                    doExtend = toOld > cellInfo.to
                }
                else {
                    //beyond the end of this cell - no impact to the cell
                }
            })

            if(doDelete) {
                //cells that are no longer present
                cellsToDelete.push(cellInfo)
            }
            else {

                let cellUpdateInfo: CellUpdateInfo = {
                    cellInfo: cellInfo,
                    action: doUpdate ? Action.update : doRemap ? Action.remap : Action.reuse
                }

                if(doRemap) { 
                    let fromLineObject = docText.lineAt(changes!.mapPos(cellInfo.from))
                    cellUpdateInfo.newFrom = fromLineObject.from
                    cellUpdateInfo.newFromLine = fromLineObject.number

                    if(!doExtend) {
                        let toLineObject = docText.lineAt(changes!.mapPos(cellInfo.to))
                        cellUpdateInfo.newTo = toLineObject.to
                        cellUpdateInfo.newToLine = toLineObject.number

                        if(doUpdate) {
                            cellUpdateInfo.codeText = docText.sliceString(extendUpdateInfo!.newFrom!,extendUpdateInfo!.newTo)
                        }
                    } 
                }
                else {
                    cellUpdateInfo.newFromLine = cellInfo.fromLine
                }

                //complete the previous cell if needed 
                if(extendUpdateInfo !== undefined) {
                    if( (cellUpdateInfo.newToLine === undefined) || (extendUpdateInfo!.newFrom === undefined) ) {
                        //these cases shouldn't happen, and we have no reasonable recourse if they do
                        throw new Error("Position info unexpectedly missing from cell update info")
                    }

                    extendUpdateInfo!.newToLine = cellUpdateInfo.newFromLine! - 1
                    extendUpdateInfo!.newTo = cellUpdateInfo.newFrom! - 1  //!!! is this right?
                    extendUpdateInfo!.codeText = docText.sliceString(extendUpdateInfo!.newFrom!,extendUpdateInfo!.newTo)
                }

                extendUpdateInfo = doExtend ? cellUpdateInfo : undefined
                cellUpdateInfos.push(cellUpdateInfo)
            }
        })
    }
    else if(docState !== undefined) {
        //if we have no changes return "reuse" cell update infos
        cellUpdateInfos.push(...docState.cellInfos.map( cellInfo => { return {action: Action.reuse, cellInfo} })) 
    }
    
    return {
        oldCellUpdateInfos: cellUpdateInfos,
        oldCellsToDelete: cellsToDelete
    }
}

/** This function gets the new cell infos based on the new parse tree and the old cell infos */
function updateLines(editorState: EditorState, oldCellUpdateInfos: CellUpdateInfo[], cellsToDelete: CellInfo[] = []) {
    
    //these are the output cell infos
    const newCellUpdateInfos: CellUpdateInfo[] = []

    //we use these variables to progress through the cell update info as we process the new parse tree.
    let currentOldIndex = -1
    let oldCellUpdateInfo: CellUpdateInfo | undefined = undefined
    let currentOldFromLine = -1
    let oldCellUsed = Array(oldCellUpdateInfos.length).fill(false)

    //record if there is a parse error
    let parseError = false

    //used to read line nubers from positions
    let docText = editorState.doc

    //walk through the new parse tree
    //and craete new cell infos
    syntaxTree(editorState).iterate({
        enter: (node) => {

            //once we reach a parse error, stop processing the tree
            if( parseError ) return

            switch(node.name) {

                case "Cell": 
                case "EmptyCell": 
                case "EndCell": 
                case "EmptyEnd":
                {
                    //get the parameters for the current new cell
                    let startLine = docText.lineAt(node.from)
                    let endLine = docText.lineAt(node.from)
                    
                    let fromPos = startLine.from
                    let toPos = endLine.to
                    let fromLine = startLine.number
                    let toLine = endLine.number
                    let codeText = editorState.doc.sliceString(fromPos,toPos)

                    //if we have cell update infos, find the one that corresponsds to the current start line
                    if(oldCellUpdateInfos.length > 0) {
                        while((currentOldFromLine < fromLine) && currentOldIndex < oldCellUpdateInfos!.length - 1) {
                            currentOldIndex++
                            oldCellUpdateInfo = oldCellUpdateInfos![currentOldIndex]
                            //the following entry should be defined if we get here (maybe use a union coe cell info instead)
                            currentOldFromLine = oldCellUpdateInfo!.newFromLine!
                        }
                    }
                    
                    let newCellUpdateInfo: CellUpdateInfo | undefined = undefined 
                    if( (oldCellUpdateInfo !== undefined) && (oldCellUpdateInfo!.cellInfo !== undefined) &&  (oldCellUpdateInfo!.newFromLine == fromLine)) {
                        let oldCellInfo = oldCellUpdateInfo!.cellInfo!
                        oldCellUsed[currentOldIndex] = true

                        if(codeText !== oldCellInfo.docCode) {
                            newCellUpdateInfo = {
                                action: Action.update,
                                cellInfo: oldCellInfo,
                                newFrom: fromPos,
                                newTo: toPos,
                                newFromLine: fromLine,
                                newToLine: toLine,
                                codeText: codeText
                            }
                        }
                        else if( oldCellInfo.from != fromPos || oldCellInfo.to != toPos || oldCellInfo.fromLine != fromLine || oldCellInfo.toLine != toLine ) {

                            newCellUpdateInfo = {
                                action: Action.remap,
                                cellInfo: oldCellInfo,
                                newFrom: fromPos,
                                newTo: toPos,
                                newFromLine: fromLine,
                                newToLine: toLine
                            }
                        }
                        else {
                            newCellUpdateInfo = oldCellUpdateInfo
                        }
                    }
                    else {
                        newCellUpdateInfo = {
                            action: Action.create,
                            newFrom: fromPos,
                            newTo: toPos,
                            newFromLine: fromLine,
                            newToLine: toLine,
                            codeText: codeText
                        }
                    }

                    newCellUpdateInfos.push(newCellUpdateInfo)
                    break
                }
                 
                case "\u26A0": {
                    console.log("Parse Error!")
                    parseError = true
                }

                default:
                    break
            }
        }
    })

    //here we decide if we use the new parse tree info   
    if( parseError && oldCellUpdateInfos !== undefined ) {
        //don't use the parse data when we have an error (unless we had not previous info)
        return {
            parseErrorInfo:parseError
        }
    }
    else {
        //additional cells we need to delete
        let unusedOldCells: CellInfo[] = []
        oldCellUsed.forEach( (cellUsed,index) => {
            if(!cellUsed) {
                let cellInfo = oldCellUpdateInfos![index].cellInfo
                if(cellInfo !== undefined) {
                    unusedOldCells.push(cellInfo)
                }
            }
        })
        if(unusedOldCells.length > 0) {
            cellsToDelete = cellsToDelete.concat(unusedOldCells)
        }

        return {
            newCellUpdateInfos: newCellUpdateInfos,
            newCellsToDelete: cellsToDelete,
            parseErrorInfo:parseError
        }
    }
    
}

//--------------------------
// Issue Session Commands
//--------------------------

/** This method issues any needed session commands from the current state. */
function issueSessionCommands(activeCellInfos: CellInfo[], cellInfosToDelete: CellInfo[], docVersion: number, nonCommandIndex: number) {
    let commands:CodeCommand[] = []
    let updatedCellInfos: CellInfo[] = []

    //send all the delete commands if there are any
    cellInfosToDelete.forEach(cellInfo => {
        commands.push(createDeleteAction(cellInfo)) 
    })     

    //send create/update commands for any cell with code dirty beneat the non-command index
    for(let index = 0; index < nonCommandIndex; index++) {
        let cellInfo = activeCellInfos[index]
        if(cellInfo.status == "code dirty") {
            let {newCellInfo,command} = createAddUpdateAction(cellInfo,index)
            updatedCellInfos.push(newCellInfo)
            commands.push(command) 
        }
        else {
            updatedCellInfos.push(cellInfo)
        }
    }

    //send commands
    if(commands.length > 0) {
        sendCommands(commands,docVersion)
    }

    //return modified cell infos
    return updatedCellInfos
}

function createDeleteAction(cellInfo: CellInfo) {
    //console.log("Delete command: id = " + cellInfo.id)
    let command: CodeCommand = {
        type:"delete",
        lineId: cellInfo.id
    }
    return command
}

function createAddUpdateAction(cellInfo: CellInfo, zeroBasedIndex: number) {
    let command: CodeCommand = {
        type: "",
        lineId: cellInfo.id,
        code: cellInfo.docCode
        
    }
    if(cellInfo.modelCode === null) {
        command.type = "add"
        command.after = zeroBasedIndex //NOTE: the after value is one less than the 1-based index, which is just the zero based index
    }
    else {
        command.type = "update"
    }

    let newCellInfo: CellInfo = CellInfo.updateCellInfoForCommand(cellInfo)

    return {command,newCellInfo}
}

function sendCommands(commands: CodeCommand[],docVersion: number) {
    //console.log("Commands to send:")
    //console.log(JSON.stringify(commands))
    evaluateSessionCmds("ds1",commands,docVersion)
}

