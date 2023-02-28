import {CodeCommand,evaluateSessionCmds,SessionOutputEvent} from "../session/sessionApi"
import CellInfo from "./CellInfo"
import {syntaxTree} from "@codemirror/language"
import {EditorView, Decoration} from "@codemirror/view"
import type { EditorState, Transaction, Extension, ChangeSet, Range } from '@codemirror/state'
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
    parseTreeCurrent: boolean
    hasParseErrors: boolean
    hasDirtyCells: boolean
    decorations: RangeSet<Decoration>
}

enum Action {
    create,
    update,
    delete,
    remap,
    reuse
}


type CellUpdateInfo = {
    action: Action
    cellInfo?: CellInfo
    newFrom?: number
    newTo?: number
    newFromLine?: number
    newToLine?: number
    codeText?: string
}

type ParseErrorInfo = {
    hasError: boolean
}

const INITIAL_DOCUMENT_VERSION = 0

const INVALID_CELL_INDEX = -1
const INVALID_LINE_NUMBER = -1 //line number is 1 based

//==============================
// Sesssion Event Processing
//==============================

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
            docState = processSessionMessages(transaction,docState)
        }
        return processDocChanges(transaction.state,transaction,docState)
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

/** This function creates a docState object. */
function createDocState(cellInfos: CellInfo[],docVersion: number,parseTreeUsed: boolean, hasParseErrors: boolean): DocState {
    let decorations: Range<Decoration>[] = []
    if(cellInfos.length > 0) {
        cellInfos.forEach(cellInfo => cellInfo.pushDecorations(decorations))
    }

    return {
        docVersion: docVersion,
        cellInfos: cellInfos,
        parseTreeCurrent: parseTreeUsed,
        hasParseErrors: hasParseErrors,
        hasDirtyCells: cellInfos.some(cellInfo => cellInfo.status == "code dirty"),
        decorations: (decorations.length > 0) ? 
            RangeSet.of(decorations) : Decoration.none
    }
}

//--------------------------
// Process Session Messages
//--------------------------

/** This function processes messages from the R session, which are passed in as transaction effects. 
 * It returns an updated docState. */
function processSessionMessages(transaction: Transaction, docState: DocState) {

    let effects: readonly StateEffect<any>[] = transaction.effects

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

            docState = createDocState(newCellInfos,docState.docVersion,docState.parseTreeCurrent,docState.hasParseErrors)
        }
    }
    return docState
}

/** This function finds the cell info with the given line ID. */
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

/** This method processes changes from the editor, returning an updated doc state. */
function processDocChanges(editorState: EditorState, transaction: Transaction | undefined = undefined, docState: DocState | undefined = undefined) {
    
    //SHOULD RENAME THIS TO something about processing the parse tree rather than using
    let useParseTree = getUseParseTree(editorState, transaction, docState) 

    if( (transaction && transaction.docChanged) || useParseTree ) {

        let cellUpdateInfos: CellUpdateInfo[] | undefined = undefined
        let cellsToDelete: CellInfo[] | undefined = undefined
        let nonCommandIndex = 0
        let parseTreeUsed = false
        let hasParseErrors = false 

        let {oldCellUpdateInfos, oldCellsToDelete} = updateOldCells(editorState, transaction!, docState)
        
        if(useParseTree) {
            let {newCellUpdateInfos, newCellsToDelete, parseErrorInfo, newActiveEditIndex, newActiveEditType} = 
                parseNewCells(editorState, oldCellUpdateInfos, oldCellsToDelete)
            
            if( useCompletedParseInfo(docState, parseErrorInfo, newActiveEditIndex, newActiveEditType) ) {
                cellUpdateInfos = newCellUpdateInfos
                cellsToDelete = newCellsToDelete 
                nonCommandIndex = getNonCommandIndex(cellUpdateInfos,newActiveEditIndex)
                parseTreeUsed = true
            }
            else {
                hasParseErrors = parseErrorInfo.hasError
            }
        }
        else {
            hasParseErrors = docState !== undefined ? docState!.hasParseErrors : false
        }

        if( cellUpdateInfos === undefined || cellsToDelete === undefined) {
            cellUpdateInfos = oldCellUpdateInfos
            cellsToDelete = oldCellsToDelete 
            nonCommandIndex = 0  //send no commands
        } 

        let docVersion = (docState !== undefined) ? docState.docVersion + 1 : INITIAL_DOCUMENT_VERSION 

        let cellInfos = createCellInfos(cellUpdateInfos,docVersion)

        if( nonCommandIndex > 0 || cellsToDelete.length > 0 ) {
            cellInfos = issueSessionCommands(cellInfos,cellsToDelete,docVersion,nonCommandIndex)
        }
            
        return createDocState(cellInfos,docVersion,parseTreeUsed,hasParseErrors)
    }
    else {
        //no change to doc state
        if(docState === undefined) throw new Error("Unexpected: doc state misssing") //this shouldn't happen

        return docState!
    }
}


/** This function decides if we want to use the parse tree, or propogate the old cells ourselves. */
function getUseParseTree(editorState: EditorState, transaction: Transaction | undefined = undefined, docState: DocState | undefined = undefined) {
    
    if(docState === undefined) {
        //if this is the first pass, use the parse tree
        return true
    }

    if(transaction && transaction.docChanged) {
        //if there are new edits
        //use the parse tree if we are in an empty cell created by adding (rather than deleting)
        //(I think this logic assumes there is on edit included here, to get the result intended)
        if(textAdded(transaction.changes)) { 
            let activeLineObject = editorState.doc.lineAt(editorState.selection.main.head)
            if(activeLineObject.text.trim() == "") {
                return true
                //THE LOGIC FOR EMPTY PARSE ELEMENT DIDN"T WORK (at least for empty end)
                //FOR NOW AI WILL JUST USE THE PARSE TREE ON AN EMPTY LINE FROM TEXT ADDITION
                //let lineEndPos = activeLineObject.to
                //let node = syntaxTree(editorState).resolve(lineEndPos,1)
                //return (node.name == "EmptyLine" || node.name == "EmptyEnd")
            }
        }
        else return false
    }
    else {
        //if there are no new edits
        //use the parse tree if the document is not current
        //and there are no errors
        //and there is no active eidt
        if( !docState.parseTreeCurrent && !docState.hasParseErrors ) {
            let activeLine = editorState.doc.lineAt(editorState.selection.main.head).number
            let activeCellInfo = docState.cellInfos.find( cellInfo => cellInfo.fromLine >= activeLine && cellInfo.toLine <= activeLine )
            return activeCellInfo === undefined || !isCellDirty(activeCellInfo)
        }
        else return false
    }
}

/** This fucntion returns true if the changes set adds text, rather than just deletes. */
function textAdded(changes: ChangeSet) {
    let textAdded = false
    changes.iterChanges( (oldFrom,oldT,newFrom,newTo,text) => { if(text.length > 0) textAdded = true })
    return textAdded
}

function isCellDirty(activeCellInfo: CellInfo) {
    return activeCellInfo.status == "code dirty"
}

function useCompletedParseInfo( docState: DocState | undefined = undefined, 
                                parseErrorInfo: ParseErrorInfo,
                                activeEditIndex: number,
                                activeEditType: string) {
    //CLEAT THIS COMMENT OUT LATER? OR REFINE THIS?  TEMPORARLY LOGIC?
    //use the parse info if we are here and: 
    // - we have no fallback state
    // - we are not in an active edit
    // - we are in an active edit, but on an empty line
    //note that we would not be here if we did not use the parser: if there was a document change, we are on an empty
    //line and we added text (meaning we are not in the middle of typing on a line and we did not delete back to 
    //an empty line) 

    //there is no fallback if there is no docstate
    if( docState === undefined ) return true

    //we will not use parse info if there are any parse errors, since this can blow up the tree
    if( parseErrorInfo.hasError === true) return false


    //if there is an active edit, we will not use the parse data, unless the active data is an empty cell
    return activeEditIndex == INVALID_CELL_INDEX || isEmptyCell(activeEditType) 
     
}

function isEmptyCell(nodeName: string) {
    return nodeName == "EmptyCell" || nodeName == "EmptyEnd"
}

function actionIsAnEdit(action: Action) {
    return action == Action.create || action == Action.update || action == Action.delete
}

function getNonCommandIndex(cellUpdateInfos: CellUpdateInfo[] | undefined, newActiveEditIndex: number) {
    if(cellUpdateInfos != undefined) {
        return newActiveEditIndex == INVALID_CELL_INDEX ? cellUpdateInfos.length : newActiveEditIndex
    }
    else {
        return 0
    }
}

/** This function creates a CellInfo object from a CellUpdateInfo. */
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

/** This function gets update data for the cells from the previous doc state based on text changes. It
 * does not use the new parse tree. */
function updateOldCells(editorState: EditorState, transaction: Transaction, docState?: DocState) {
    let cellUpdateInfos: CellUpdateInfo[] = []
    let cellsToDelete: CellInfo[] = []

    let docText = editorState.doc

    //get the update info for each cell
    if(docState !== undefined) {
        if(transaction.docChanged) {
            let changes = transaction.changes
            let prevChangedUpdateInfo: CellUpdateInfo | null = null

            docState!.cellInfos.forEach( (cellInfo) => {
                let doDelete = false
                let doUpdate = false
                let doRemap = false

                //check effect of all text edits on this line
                changes.iterChangedRanges( (fromOld,toOld,fromNew,toNew) => {
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

                    let cellUpdateInfo: CellUpdateInfo = {
                        cellInfo: cellInfo,
                        action: doUpdate ? Action.update : doRemap ? Action.remap : Action.reuse
                    }

                    if(doRemap) { 
                        let fromLineObject = docText.lineAt(changes.mapPos(cellInfo.from))
                        cellUpdateInfo.newFrom = fromLineObject.from
                        cellUpdateInfo.newFromLine = fromLineObject.number

                        let toLineObject = docText.lineAt(changes.mapPos(cellInfo.to))
                        cellUpdateInfo.newTo = toLineObject.to
                        cellUpdateInfo.newToLine = toLineObject.number

                        if(doUpdate) {
                            cellUpdateInfo.codeText = docText.sliceString(cellUpdateInfo.newFrom!,cellUpdateInfo.newTo!)
                        }

                    }
                    else {
                        cellUpdateInfo.newFromLine = cellInfo.fromLine
                        cellUpdateInfo.newFrom = cellInfo.from
                    }

                    //extend the previous cell if needed 
                    if(prevChangedUpdateInfo !== null) {
                        //NOTE - we require several items be set here, and they should be. I should enforce that better
                        //prevChanged - this was doUpdate/doRemap
                        //current - this is doRemap at least

                        if(prevChangedUpdateInfo!.newToLine != cellUpdateInfo.newFromLine - 1) {
                            prevChangedUpdateInfo!.newToLine = cellUpdateInfo.newFromLine! - 1
                            prevChangedUpdateInfo!.newTo = cellUpdateInfo.newFrom! - 1  
                            prevChangedUpdateInfo!.codeText = docText.sliceString(prevChangedUpdateInfo!.newFrom!,prevChangedUpdateInfo!.newTo)
                        }
                    }

                    if(doUpdate) prevChangedUpdateInfo = cellUpdateInfo
                    else prevChangedUpdateInfo = null

                    cellUpdateInfos.push(cellUpdateInfo)
                }
            })

            //extend the last cell if needed
            if(cellUpdateInfos.length > 0) {
                //NOTE - I require newFrom to be on here
                //I am setting it, but I don't enfore that in a solid way and I think it well be error prone
                let lastUpdateInfo = cellUpdateInfos[cellUpdateInfos.length-1]
                if(lastUpdateInfo.newTo != docText.length ) {
                    lastUpdateInfo.newTo = docText.length
                    lastUpdateInfo.codeText = docText.sliceString(lastUpdateInfo!.newFrom!,lastUpdateInfo!.newTo)
                }
            }
        }
        else {
            //if we have no changes return "reuse" cell update infos
            cellUpdateInfos.push(...docState!.cellInfos.map( cellInfo => { return {
                action: Action.reuse, 
                cellInfo,
                newFrom: cellInfo.from, 
                newFromLine: cellInfo.fromLine
            } })) 
        }
    }
    
    return {
        oldCellUpdateInfos: cellUpdateInfos,
        oldCellsToDelete: cellsToDelete
    }
}

/** This function creates new cells based on the updatede document parse tree. */
function parseNewCells(editorState: EditorState, oldCellUpdateInfos: CellUpdateInfo[], cellsToDelete: CellInfo[] = []) {
    
    //these are the output cell infos
    const newCellUpdateInfos: CellUpdateInfo[] = []

    //record if there is a parse error
    let parseErrorInfo: ParseErrorInfo = {
        hasError: false
    }

    //this is the index of a cell that is actively being edited
    let activeCellIndex = INVALID_CELL_INDEX
    let activeCellType = "" //TEMPORARY - while we work on emtpy cell detection
 
    //we use these variables to progress through the cell update info as we process the new parse tree.
    let currentOldIndex = INVALID_CELL_INDEX
    let oldCellUpdateInfo: CellUpdateInfo | undefined = undefined
    let currentOldFromLine = INVALID_LINE_NUMBER
    let oldCellUsed = Array(oldCellUpdateInfos.length).fill(false)

    

    //used to read line nubers from positions
    let docText = editorState.doc

    let selectionLine = docText.lineAt(editorState.selection.main.head).number

    //walk through the new parse tree
    //and craete new cell infos
    syntaxTree(editorState).iterate({
        enter: (node) => {

            //once we reach a parse error, stop processing the tree
            if( parseErrorInfo.hasError ) return

            switch(node.name) {

                case "Cell": 
                case "EmptyCell": 
                case "EndCell": 
                case "EmptyEnd":
                {
                    //get the parameters for the current new cell
                    let startLine = docText.lineAt(node.from)
                    let endLine = docText.lineAt(node.to)
                    
                    let fromPos = startLine.from
                    let toPos = endLine.to
                    let fromLine = startLine.number
                    let toLine = endLine.number
                    let codeText = editorState.doc.sliceString(fromPos,toPos)

                    //record the current cell index
                    if(fromLine <= selectionLine && toLine >= selectionLine) {
                        activeCellIndex = newCellUpdateInfos.length
                        activeCellType = node.name
                    }

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

                        //NOTE - comparisons to towards the old cell info, not the propogated old cell values, since we are measuring change to previous state
                        //the propogated old cell values are used to compare the cells and they will be used if we ignore the new parse data.
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
                            newCellUpdateInfo = {
                                action: Action.reuse,
                                cellInfo: oldCellInfo
                            }
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
                    parseErrorInfo.hasError = true
                }

                default:
                    break
            }
        }
    })

    //get active edit info
    let activeEditIndex = INVALID_CELL_INDEX
    let activeEditType = ""
    if(activeCellIndex != INVALID_CELL_INDEX) {
        let cellUpdateInfo = newCellUpdateInfos[activeCellIndex] 
        if( actionIsAnEdit(cellUpdateInfo.action) || (cellUpdateInfo.cellInfo !== undefined && isCellDirty(cellUpdateInfo.cellInfo!)) ) {
            activeEditIndex = activeCellIndex
            activeEditType = activeCellType
        }
    }

    //here we decide if we use the new parse tree info   
    if( parseErrorInfo.hasError && oldCellUpdateInfos !== undefined ) {
        //don't use the parse data when we have an error (unless we had not previous info)
        return {
            parseErrorInfo:parseErrorInfo,
            newActiveEditIndex: activeEditIndex,
            newActiveEditType: activeEditType
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
            parseErrorInfo: parseErrorInfo,
            newActiveEditIndex: activeEditIndex,
            newActiveEditType: activeEditType
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
    //for(let index = 0; index < nonCommandIndex; index++) {
    activeCellInfos.forEach( (cellInfo,index) => {
        if( cellInfo.status == "code dirty" && index < nonCommandIndex ) {
            let {newCellInfo,command} = createAddUpdateAction(cellInfo,index)
            updatedCellInfos.push(newCellInfo)
            commands.push(command) 
        }
        else {
            updatedCellInfos.push(cellInfo)
        }
    })

    //send commands
    if(commands.length > 0) {
        sendCommands(commands,docVersion)
    }

    //return modified cell infos
    return updatedCellInfos
}

/** This function creates a delete command object. */
function createDeleteAction(cellInfo: CellInfo) {
    //console.log("Delete command: id = " + cellInfo.id)
    let command: CodeCommand = {
        type:"delete",
        lineId: cellInfo.id
    }
    return command
}

/** This function creates an add or update command for the cell Info and returns
 * the updated cell infos associated with sending the command. */
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

/** This function sends a list of commands. */
function sendCommands(commands: CodeCommand[],docVersion: number) {
    //console.log("Commands to send:")
    //console.log(JSON.stringify(commands))
    evaluateSessionCmds("ds1",commands,docVersion)
}

