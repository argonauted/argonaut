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
    docVersion: number,
    cellInfos: CellInfo[]
    cellsToDelete: CellInfo[]
    decorations: RangeSet<Decoration>
    dirtyCells: boolean
}

type CellUpdateInfo = {
    cellInfo: CellInfo
    doUpdate: boolean
    doRemap: boolean
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
        docState = issueSessionCommands(transaction.state,docState)
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

function createDocState(cellInfos: CellInfo[], cellsToDelete: CellInfo[],docVersion: number): DocState {
    let decorations: Range<Decoration>[] = []
    if(cellInfos.length > 0) {
        cellInfos.forEach(cellInfo => cellInfo.pushDecorations(decorations))
    }

    return {
        docVersion: docVersion,
        cellInfos: cellInfos,
        cellsToDelete: cellsToDelete,
        decorations: (decorations.length > 0) ? 
            RangeSet.of(decorations) : Decoration.none,
        dirtyCells: cellInfos.some(cellInfo => cellInfo.status == "code dirty")
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

            docState = createDocState(newCellInfos,[],docState.docVersion)
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
    let docVersion = (docState !== undefined) ? docState.docVersion + 1 : 99 //increment version here for new document
    let {cellUpdateMap, cellsToDelete} = getUpdateInfo(changes,docState)
    let cellInfos = updateLines(editorState, cellUpdateMap,docVersion)
    return createDocState(cellInfos,cellsToDelete,docVersion)
}

function getUpdateInfo(changes?: ChangeSet, docState?: DocState) {
    let cellUpdateMap: Record<number,CellUpdateInfo> = {}
    let cellsToDelete: CellInfo[] = []

    //get the update info for each cell
    if((docState !== undefined)&&(changes !== undefined)) {
        docState!.cellInfos.forEach( (cellInfo) => {

            let doDelete = false
            let doUpdate = false
            let doRemap = false

            //check effect of all text edits on this line
            changes!.iterChangedRanges((fromOld,toOld,fromNew,toNew) => {
                if(fromOld < cellInfo.from) {
                    if(toOld < cellInfo.from) {
                        //before the start of this cell - we need to remap
                        doRemap = true
                    }
                    else {
                        //overlaps cell start and maybe the end - delete this cell
                        doDelete = true
                    }
                }
                else if(fromOld <= cellInfo.to) {
                    //change starts in cell, ends inside or after - update cell
                    doUpdate = true
                    doRemap = true //only end is remapped
                }
                else {
                    //beyond the end of this cell - no impact to the cell
                    //doStartRemap = true
                }
            })

            if(doDelete) {
                cellsToDelete.push(cellInfo)
            }
            else {
                let newFrom = doRemap ? changes!.mapPos(cellInfo.from) : cellInfo.from

                //////////////////////////////////////////
                //TEMPORARY FIX FOR NOT HANDLING EMPTY LINES IN DELETE 
                let newTo = doRemap ? changes!.mapPos(cellInfo.to) : cellInfo.to
                if(newTo - newFrom <= 0) {
                    //a zero length line is currently omitted from the parsed lines
                    //so it will disappear(!) FIX THAT
                    //If this line has already been sent to the session, send a delete for it.
                    if(cellInfo.modelCode !== null) {
                        cellsToDelete.push(cellInfo)
                    }
                }
                else 
                //////////////////////////////////////////

                cellUpdateMap[newFrom] = {cellInfo,doUpdate,doRemap}
            }
        })
    }
    
    return {cellUpdateMap, cellsToDelete}
}

//cycle through the new syntax tree, processing each code block:
// - lookup transition cell info using the new start position
//   - for cells found in transition info
//     - unchanged - remap the decoration and cell info
//     - changed - crete the new decoration and cell info (with a hook to send an update command)
//   - fpr cells not found in the transition info
//     - create new decdoration and cell info (with a hook to send create command)
// - leave a hook to send delete commands for cells that should be deleted
function updateLines(editorState: EditorState, cellUpdateMap: Record<number,CellUpdateInfo> | null, docVersion: number) { 
    const cellInfos: CellInfo[] = []

    //get the updated code blocks
    syntaxTree(editorState).iterate({
        enter: (node) => {
            if (node.name == "CodeExpr") {

                let fromPos = node.from
                let toPos = node.to
                let codeText = editorState.doc.sliceString(fromPos,toPos+1)
                //I should annotate the name,assignOp,body within the code block

                let newCellInfo: CellInfo | null = null

                //try to look up if this is an existing cell
                let cellUpdateInfo: CellUpdateInfo | undefined = undefined
                if(cellUpdateMap !== null) {
                    cellUpdateInfo = cellUpdateMap[fromPos]
                }

                if(cellUpdateInfo !== undefined) {
                    let oldCellInfo = cellUpdateInfo!.cellInfo

                    if(cellUpdateInfo!.doUpdate) {
                        //update to a cell
                        newCellInfo = CellInfo.updateCellInfoCode(oldCellInfo,fromPos,toPos,codeText,docVersion)
                    }
                    else if(cellUpdateInfo!.doRemap) {
                        //no change to a cell - just remap
                        newCellInfo = CellInfo.remapCellInfo(oldCellInfo,fromPos,toPos)
                    }
                    else {
                        newCellInfo = oldCellInfo
                    }
                }
                else {
                    //create new objects
                    newCellInfo = CellInfo.newCellInfo(fromPos,toPos,codeText,docVersion)
                }

                cellInfos.push(newCellInfo!)
            }
        }
    })

    return cellInfos
}

//--------------------------
// Issue Session Commands
//--------------------------

/** This method issues any needed session commands from the current state. */
function issueSessionCommands(editorState: EditorState, docState: DocState) {
    let commands:CodeCommand[] = []

    //send all the delete commands if there are any
    if(docState.cellsToDelete.length != 0) {
        docState.cellsToDelete.forEach(cellInfo => {
            let command = createDeleteAction(cellInfo)
            commands.push(command)  
        })    
        docState.cellsToDelete = []
    } 

    //send update commands based on selection head location (save when the user leaves the line)
    let selectionHead = editorState.selection.asSingle().main.head
    
    if(docState.dirtyCells) { 
        let doUpdateArray = docState.cellInfos.map(cellInfo => (cellInfo.status == "code dirty") &&
                                                                ((cellInfo.from > selectionHead) || (cellInfo.to < selectionHead)) )

        if(doUpdateArray.includes(true)) {
            let newCellInfos: CellInfo[] = []
            docState.cellInfos.forEach( (cellInfo,index) => {
                if(doUpdateArray[index]) {
                    //create command, return updated cell info
                    let {newCellInfo,command} = createAddUpdateAction(cellInfo,docState.cellInfos)
                    newCellInfos.push(newCellInfo)
                    commands.push(command)
                }
                else {
                    //no change to the cell info
                    newCellInfos.push(cellInfo)
                }

            })

            //get the updated state
            docState = createDocState(newCellInfos,[],docState.docVersion)
        }
    }

    if(commands.length > 0) {
        sendCommands(commands,docState.docVersion)
    }

    return docState
}

function createDeleteAction(cellInfo: CellInfo) {
    //console.log("Delete command: id = " + cellInfo.id)
    let command: CodeCommand = {
        type:"delete",
        lineId: cellInfo.id
    }
    return command
}

function createAddUpdateAction(cellInfo: CellInfo, cellInfos: CellInfo[]) {
    let command: CodeCommand = {
        type: "",
        lineId: cellInfo.id,
        code: cellInfo.docCode
        
    }
    if(cellInfo.modelCode === null) {
        let lineNumber0Base = cellInfos.indexOf(cellInfo)
        if(lineNumber0Base < 0) {
            //HANDLE BETTER THAN THIS!!!
            throw new Error("Line not found!")
        }
        //console.log("Add command: id = " + cellInfo.id)
        command.type = "add"
        command.after = lineNumber0Base //the after value is one less than the 1-based line nubmer
    }
    else {
        //console.log("Update command: id = " + cellInfo.id)
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

