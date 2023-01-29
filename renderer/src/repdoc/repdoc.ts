import {CodeCommand,multiCmd} from "../session/sessionApi"
import CellInfo from "./CellInfo"
import {syntaxTree} from "@codemirror/language"
import {EditorView, Decoration} from "@codemirror/view"
import type { EditorState, Extension, Range, ChangeSet } from '@codemirror/state'
import { RangeSet, StateField, StateEffect } from '@codemirror/state'

//==============================
// Sesssion Event Processing
//==============================

export const sessionEventEffect = StateEffect.define<{type: string, data: any}>()

/** This function dispatches a document transaction for the given session event. */
export function passEvent(view: any, eventName: string, data: any) {
    if(view !== null) {
        let effects: StateEffect<any>[] = [sessionEventEffect.of({type:eventName,data:data})]
        //if(!view.state.field(ReactiveCodeField,false)) {
        //    effects.push(StateEffect.appendConfig.of([ReactiveCodeField]))
        //}
        view.dispatch({effects: effects})
    }
}

//===============================
// Repdoc Codemirror Extension
//===============================

const ReactiveCodeField = StateField.define<CellState>({
    create(editorState) {
        return processDocChanges(editorState)
    },

    update(cellState, transaction) {
        if(transaction.effects.length > 0) {
            cellState = processSessionMessages(transaction.effects,cellState)
        }
        if (transaction.docChanged) {
            cellState = processDocChanges(transaction.state,transaction.changes,cellState)
        }
        cellState = issueSessionCommands(transaction.state,cellState)
        return cellState
    },

    provide(cellState) {
        return EditorView.decorations.from(cellState, cellState => cellState.decorations)
    },
})

/** This is the extension to interface with the reactive code model and display the output in the editor */
export const repdoc = (): Extension => {
    return [
        ReactiveCodeField,
    ]
}

//===================================
// Data Structures
//===================================


type CellState = {
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

//===================================
// Internal Functions
//===================================

function createCellState(cellInfos: CellInfo[], cellsToDelete: CellInfo[]): CellState {
    return {
        cellInfos: cellInfos,
        cellsToDelete: cellsToDelete,
        decorations: (cellInfos.length > 0) ? 
            RangeSet.of(cellInfos.map(cellInfo => cellInfo.placedDecoration)) : 
            Decoration.none,
        dirtyCells: cellInfos.some(cellInfo => cellInfo.status == "code dirty")
    }
}

//--------------------------
// Process Session Messages
//--------------------------

type CellStatusUpdate = {}

/** This function process session messages, which are passed in as transaction effects. 
 * It returns an updated cellState. */
function processSessionMessages(effects: readonly StateEffect<any>[], cellState: CellState) {

    let sessionEventEffects = effects.filter(effect => effect.is(sessionEventEffect))

    if(sessionEventEffects.length > 0) {
        let cellChanges: (CellStatusUpdate | null)[] = Array(cellState.cellInfos.length)
        sessionEventEffects.forEach(effect => {
            switch(effect.value.type) {
                case "initComplete":
                    //nothing here?
                    break

                case "console":
                    //get the active cell!
                    break

                case "plotReceived":
                    //get the active cell
                    break

                case "docStatus":
                    //active cell is completed
                    //get next cells that are NOT completed
                    break

                case "evalStart":
                    //mark up to here as completed? Or nothing.
                    break

                default:
                    break
            }
        })
    }
    return cellState
}

//--------------------------
// Process Document Changes
//--------------------------

/** This method processes document changes, returning an updated cell state. */
function processDocChanges(editorState: EditorState, changes: ChangeSet | undefined = undefined,  cellState: CellState | undefined = undefined) {
    let {cellUpdateMap, cellsToDelete} = getUpdateInfo(changes,cellState)
    let cellInfos = updateCellState(editorState, cellUpdateMap)
    return createCellState(cellInfos,cellsToDelete)
}

function getUpdateInfo(changes?: ChangeSet, cellState?: CellState) {
    let cellUpdateMap: Record<number,CellUpdateInfo> = {}
    let cellsToDelete: CellInfo[] = []

    //get the update info for each cell
    if((cellState !== null)&&(changes !== null)) {
        cellState!.cellInfos.forEach( (cellInfo) => {

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
function updateCellState(editorState: EditorState, cellUpdateMap: Record<number,CellUpdateInfo> | null) { 
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
                        newCellInfo = CellInfo.updateCellInfoCode(oldCellInfo,fromPos,toPos,codeText)
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
                    newCellInfo = CellInfo.newCellInfo(fromPos,toPos,codeText)
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
function issueSessionCommands(editorState: EditorState, cellState: CellState) {
    let commands:CodeCommand[] = []

    //send all the delete commands if there are any
    if(cellState.cellsToDelete !== null) {
        cellState.cellsToDelete!.forEach(cellInfo => {
            let command = createDeleteAction(cellInfo)
            commands.push(command)  
        })    
    } 

    //send update commands based on selection head location (save when the user leaves the line)
    let selectionHead = editorState.selection.asSingle().main.head
    
    if(cellState.dirtyCells) { 
        let doUpdateArray = cellState.cellInfos.map(cellInfo => (cellInfo.from > selectionHead) || (cellInfo.to < selectionHead) )

        if(doUpdateArray.includes(true)) {
            let newCellInfos: CellInfo[] = []
            cellState.cellInfos.forEach( (cellInfo,index) => {
                if(doUpdateArray[index]) {
                    //create command, return updated cell info
                    let {newCellInfo,command} = createAddUpdateAction(cellInfo,cellState.cellInfos)
                    newCellInfos.push(newCellInfo)
                    commands.push(command)
                }
                else {
                    //no change to the cell info
                    newCellInfos.push(cellInfo)
                }

            })

            //get the updated state
            cellState = createCellState(newCellInfos,[])
        }
    }

    if(commands.length > 0) {
        sendCommands(commands)
    }

    return cellState
}

function createDeleteAction(cellInfo: CellInfo) {
    console.log("Delete command: id = " + cellInfo.id)
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
        console.log("Add command: id = " + cellInfo.id)
        command.type = "add"
        command.after = lineNumber0Base //the after value is one less than the 1-based line nubmer
    }
    else {
        console.log("Update command: id = " + cellInfo.id)
        command.type = "update"
    }

    let newCellInfo: CellInfo = CellInfo.updateCellInfoForCommand(cellInfo)

    return {command,newCellInfo}
}

function sendCommands(commands: CodeCommand[]) {
    console.log("Commands to send:")
    console.log(JSON.stringify(commands))
    multiCmd("ds1",commands)
}

