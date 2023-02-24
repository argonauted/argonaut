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
    cellInfo?: CellInfo
    doUpdate: boolean
    doRemap: boolean
    newFrom: number
    newTo: number
    newFromLine: number
    newToLine: number
    text?: string
    activeEdit: boolean
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
    let docVersion = (docState !== undefined) ? docState.docVersion + 1 : 99 //increment version here for new document //create good initial value - not 99
    let {cellUpdateInfos, cellsToDelete} = getUpdateInfo(editorState, changes,docState)
    let {cellInfos,unusedOldCells} = updateLines(editorState, cellUpdateInfos,docVersion)
    return createDocState(cellInfos,cellsToDelete,docVersion)
}

/** This function gets update data for the cells from the previous stat 
 * This does not use the new parse results. */
function getUpdateInfo(editorState: EditorState, changes?: ChangeSet, docState?: DocState) {
    let cellUpdateInfos: CellUpdateInfo[] = []
    let cellsToDelete: CellInfo[] = []

    let docText = editorState.doc
    let previousToLine = 0

    let selectionHead = editorState.selection.asSingle().main.head
    let selectionLine = docText.lineAt(selectionHead).number

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

                        //note - if the used backspaced to an empty line, we want to keep this
                        doDelete = true
                    }
                }
                else if(fromOld <= cellInfo.to) {
                    //change starts in cell, ends inside or after - update cell
                    doUpdate = true
                    doRemap = true
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
                //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                //DOH! I should only remap a start or end if that position is still present
                // if not, I need to decide what my new "cell boundaries" are going to be
                //LOGIC IDEA:
                // - If we do an edit that removes and adds text to one or more cells, connect the start
                //   of the lead old cell to the end of the trailing old cell
                // - when we get to the new tree, if we end up on an empty new line, keep that line fromthe new tree
                //   and break the old cell to include what is after that line.
                // - otherwise, if we are not on a new empty line, 
                //   - if there is a single edit range, then we can just keep the old remapped single cell. We may
                //     we may have some completed cells above the cursor, but we wil wait until we no longer have
                //     an active session or we end up on a empty new line.
                //   - if there are multiple edit ranges, I'm not sure how to handle this. I will just punt and use the
                //     old tree until we meet one of the above criteria. (Later I can figure somethign more clever out.)
                //
                // tldr - when an edit is active, keep the old tree UNTIL the new parse tree puts us on an empty line, Then
                // just go with the new tree - if we have no errors (Because if we hwave errors, we keep the old tree) 
                //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

                //cells still present
                let newFrom = cellInfo.from
                let newTo = cellInfo.to
                let newFromLine = cellInfo.fromLine
                let newToLine = cellInfo.toLine

                if(doRemap) {
                    newFrom = changes!.mapPos(cellInfo.from)
                    let fromLineObject = docText.lineAt(newFrom)
                    newFrom = fromLineObject.from
                    newFromLine = fromLineObject.number

                    newTo = changes!.mapPos(cellInfo.to)
                    let toLineObject = docText.lineAt(newTo)
                    newFrom = toLineObject.from
                    newToLine = toLineObject.number
                }

                //create placeholder cell update infos for lines that are skipped
                while(newFromLine - previousToLine > 1) {
                    
                    previousToLine += 1
                    let line = docText.line(previousToLine)
                    cellUpdateInfos.push({
                        text: line.text,
                        doUpdate: true,
                        doRemap: true,
                        newFrom: line.from,
                        newTo: line.to,
                        newFromLine: line.number,
                        newToLine: line.number,
                        activeEdit: (selectionLine == line.number)
                    })
                }

                //record if this cell has an active edit - selection head is in it and it is dirty
                let activeEdit = (doUpdate || cellInfo.status == "code dirty") && (newFromLine <= selectionLine) && (newToLine >= selectionLine)

                cellUpdateInfos.push({cellInfo,doUpdate,doRemap,newFrom,newTo,newFromLine,newToLine,activeEdit})

                previousToLine = newToLine
            }
        })
    }
    
    return {cellUpdateInfos,cellsToDelete}
}

/** This function gets the new cell infos based on the new parse tree and the old cell infos */
function updateLines(editorState: EditorState, cellUpdateInfos: CellUpdateInfo[], docVersion: number) {
    
    //these are the output cell infos
    const cellInfos: CellInfo[] = []

    //we use these variables to progress through the cell update info as we process the new parse tree.
    let currentOldIndex = 0
    let cellUpdateInfo = cellUpdateInfos.length > 0 ? cellUpdateInfos[currentOldIndex] : undefined
    let currentOldFromLine = cellUpdateInfo != undefined ? cellUpdateInfo.newFromLine : -1
    let oldCellUsed = Array(cellUpdateInfos.length).fill(false)

    //record when we reach an actively edited cell
    let activeEditReached = false
    let editStartLine = -1 //the lines are actually 1 based, but we will use -1 for invalid

    //record if there is a parse error
    let parseError = false

    //used to read line nubers from positions
    let docText = editorState.doc

    //walk through the new parse tree
    //and craete new cell infos
    syntaxTree(editorState).iterate({
        enter: (node) => {

            //we stop processing the new tree after an active edit or if there is a parse error
            if( activeEditReached || parseError ) return

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
                    if(cellUpdateInfos !== undefined) {
                        while((currentOldFromLine < fromLine) && currentOldIndex < cellUpdateInfos!.length - 1) {
                            currentOldIndex++
                            cellUpdateInfo = cellUpdateInfos![currentOldIndex]
                            currentOldFromLine = cellUpdateInfo!.newFromLine

                            //as we load the update infos, check if one is actively being edited
                            //if so, we will stop processing the new tree
                            //while an edit is in process we keep the previous cells and ignore the new tree
                            if(cellUpdateInfo.activeEdit) {
                                activeEditReached = true
                                editStartLine = currentOldFromLine
                                //exit the function that processes this node.
                                return
                            }
                        }
                    }



                    //check for match to this cell
                    //we need to keep track of "change" and "dirty"
                    //we need to keep track of errors!
                    
                    let newCellInfo: CellInfo | null = null

                    if(!activeEditReached) {

                        //we will only save remapped old cells for an edit and any point after

                        //create a new cellInfo

                        if((cellUpdateInfo !== undefined)&&(cellUpdateInfo.cellInfo !== undefined)&&(cellUpdateInfo.newFromLine == fromLine)) {
                            let oldCellInfo = cellUpdateInfo!.cellInfo
                            oldCellUsed[currentOldIndex] = true

                            if(codeText !== oldCellInfo.docCode) {
                                //update to a cell
                                newCellInfo = CellInfo.updateCellInfoCode(oldCellInfo,fromPos,toPos,fromLine,toLine,codeText,docVersion)
                            }
                            else if( oldCellInfo.from != fromPos || oldCellInfo.to != toPos || oldCellInfo.fromLine != fromLine || oldCellInfo.toLine != toLine ) {
                                //no change to a cell - just remap
                                newCellInfo = CellInfo.remapCellInfo(oldCellInfo,fromPos,toPos,fromLine,toLine)
                            }
                            else {
                                //no change - reuse
                                newCellInfo = oldCellInfo
                            }
                        }
                        else {
                            //create new objects
                            newCellInfo = CellInfo.newCellInfo(fromPos,toPos,fromLine,toLine,codeText,docVersion)
                        }

                        cellInfos.push(newCellInfo)
                    }
                    
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

    //NOTE SOME NAMING IS BAD - I switct "old" position and line to mean from the old state or new state values for old cells

    //if we have an actively edited cell or a parse error we will use remapped old cells rather than the new parse info
    if(parseError || activeEditReached) {
        if(activeEditReached) {
            if(cellInfos.length > 0) {
                //if we created cell infos above, use those
                let lastNewCellInfo = cellInfos[cellInfos.length-1]
                if(lastNewCell)
            }
        }
    } 


    //from here we will save all old cells
                        //we won't use any of the newly parsed data until the edit is complete
                        for(let index = currentOldIndex; index < cellUpdateInfos!.length; index++) {
                            cellUpdateInfo = cellUpdateInfos![index]

                            oldCellUsed[index] = true


                            //if we have an ective edit, don't use the newly parsed code
                            //use the rempped old code
                            let oldCellInfo = cellUpdateInfo.cellInfo

                            if(oldCellInfo !== undefined) {
                                let newCellInfo = CellInfo.remapCellInfo(oldCellInfo!,fromPos,toPos,fromLine,toLine)
                                cellInfos.push(newCellInfo)
                            }
                            else {
                                let codeText = (cellUpdateInfo.text != undefined) ? cellUpdateInfo.text! : "" //this should be defined
                                let newCellInfo = CellInfo.newCellInfo(cellUpdateInfo.newFrom,cellUpdateInfo.newTo,
                                                                    cellUpdateInfo.newFromLine,cellUpdateInfo.newToLine,
                                                                    codeText,docVersion)
                                cellInfos.push(newCellInfo)
                            }

                        }

    //record all old cells that were continued into new cell infos
    let unusedOldCells: CellInfo[] = []
    if(cellUpdateInfos !== undefined) {
        oldCellUsed.forEach( (cellUsed,index) => {
            if(!cellUsed) {
                let cellInfo = cellUpdateInfos![index].cellInfo
                if(cellInfo !== undefined) {
                    unusedOldCells.push(cellInfo)
                }
            }
        })
    }


    //we need to also return info about what index in the cellinfos is in active edit
    //we need to process errors!


    return {cellInfos,unusedOldCells}
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

