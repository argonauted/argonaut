import {syntaxTree} from "@codemirror/language"
import {WidgetType, EditorView, Decoration} from "@codemirror/view"
import type { EditorState, Extension, Range, ChangeSet } from '@codemirror/state'
import { RangeSet, StateField } from '@codemirror/state'

/** This is the extension to interface with the reactive code model and display the output in the editor */
export const repdoc = (): Extension => {

    const ReactiveCodeField = StateField.define<CellState>({
        create(editorState) {
            return processUpdate(editorState)
        },
        update(cellState, transaction) {
            if (transaction.docChanged) {
                return processUpdate(transaction.state,cellState.cellInfos,transaction.changes)
            }
            else {
                //send commands to the model, if needed
                return sendCommands(transaction.state,cellState)
            }
        },
        provide(cellState) {
            return EditorView.decorations.from(cellState, cellState => cellState.decorations)
        },
    })

    return [
        ReactiveCodeField,
    ]
}

//===================================
// Data Structures
//===================================

class CellDisplay extends WidgetType {
    id: number
    status: string
    code: string

    constructor(id:number, status: string, code: string) { 
        super() 
        this.id = id
        this.status = status
        this.code = code
    }

    eq(other: CellDisplay) { return (other.code == this.code)&&(other.id == this.id)&&(other.status == this.status) }

    toDOM() {
        let wrap = document.createElement("div")
        wrap.style.backgroundColor = this.status == "clean" ? "lightblue" : "beige"
        wrap.style.border = "1px solid black"
        wrap.innerHTML = this.id + ": " + this.code
        return wrap
    }

    ignoreEvent() { return true }
}


class CellInfo {
    readonly id: number
    readonly status: string
    readonly from: number
    readonly to: number
    readonly docCode: string
    readonly modelCode: string | null
    readonly decoration: Decoration
    readonly placedDecoration: Range<Decoration>

    private constructor(id: number, status: string, from: number,to: number,
            docCode: string, modelCode: string | null, 
            decoration: Decoration, placedDecoration: Range<Decoration>) {
        this.id = id
        this.status = status,
        this.from = from
        this.to = to
        this.docCode = docCode
        this.modelCode = modelCode
        this.decoration = decoration
        this.placedDecoration = placedDecoration
    }

    static newCellInfo(from: number,to: number,docCode: string) {
        let id = CellInfo.getId()
        let status = "dirty"
        let modelCode = null
        let decoration = Decoration.widget({
            widget: new CellDisplay(id,status,docCode),
            block: true,
            side: 1
        })
        let placedDecoration = decoration.range(to)
        return new CellInfo(id,status,from,to,docCode,modelCode,decoration,placedDecoration)
    }

    static updateCellInfo(cellInfo: CellInfo, from: number, to:number, docCode: string) {
        let status = "dirty"
        let decoration = Decoration.widget({
            widget: new CellDisplay(cellInfo.id,status,cellInfo.modelCode !== null ? cellInfo.modelCode! : ""),
            block: true,
            side: 1
        })
        let placedDecoration = decoration.range(to)
        return new CellInfo(cellInfo.id,status,from,to,docCode,cellInfo.modelCode,decoration,placedDecoration)
    }

    /** This function creates a rempped cell info, if only the position changes */
    static remapCellInfo(cellInfo: CellInfo, from: number,to: number) {
        let placedDecoration = cellInfo.decoration.range(to)
        return new CellInfo(cellInfo.id,cellInfo.status,from,to,cellInfo.docCode,cellInfo.modelCode,cellInfo.decoration,placedDecoration)
    }

    //================================================================
    // THis is a stand in. We will need to send the proper update or add command and track the state.
    //================================================================
    static tempSendCommandFunction(cellInfo: CellInfo): CellInfo {
        let status = "clean"
        let modelCode = cellInfo.docCode
        //no command for now, just print message and change cell info
        console.log("Create/Uupdate " + cellInfo.id)
        let decoration = Decoration.widget({
            widget: new CellDisplay(cellInfo.id,status,modelCode),
            block: true,
            side: 1
        })
        let placedDecoration = decoration.range(cellInfo.to)
        return new CellInfo(cellInfo.id,status,cellInfo.from,cellInfo.to,
            cellInfo.docCode,modelCode,
            decoration,  placedDecoration)
    }

    //for now we make a dummy id nere
    private static nextId = 1
    private static getId() {
        return CellInfo.nextId++
    }
}

type CellState = {
    cellInfos: CellInfo[]
    decorations: RangeSet<Decoration>
    dirtyCells: number[]
}

type CellUpdateInfo = {
    cellInfo: CellInfo
    doUpdate: boolean
    doRemap: boolean
}

//===================================
// Internal Functions
//===================================

/** This method processes a new or updated editor state */
function processUpdate(editorState: EditorState, cellInfoArray: CellInfo[] | null = null, changes: ChangeSet | null = null) {
    let {cellUpdateMap, cellsToDelete} = getUpdateInfo(cellInfoArray,changes)
    let cellState = updateCellState(editorState, cellUpdateMap)
    cellState = sendCommands(editorState,cellState,cellsToDelete)
    return cellState
}

function getUpdateInfo(cellInfoArray: CellInfo[] | null, changes: ChangeSet | null) {
    let cellUpdateMap: Record<number,CellUpdateInfo> = {}
    let cellsToDelete: CellInfo[] = []

    //get the update info for each cell
    if((cellInfoArray !== null)&&(changes !== null)) {
        cellInfoArray.forEach( (cellInfo) => {

            let doDelete = false
            let doUpdate = false
            let doRemap = false

            //check effect of all text edits on this line
            changes.iterChangedRanges((fromOld,toOld,fromNew,toNew) => {
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
                let newFrom = doRemap ? changes.mapPos(cellInfo.from) : cellInfo.from
                cellUpdateMap[newFrom] = {cellInfo,doUpdate,doRemap}
            }
        })
    }
    
    return {cellUpdateMap, cellsToDelete}
}

function createCellState(cellInfos: CellInfo[]): CellState {
    let dirtyCells: number[] = []
    cellInfos.forEach( (cellInfo,index) => {
        if(cellInfo.status == "dirty") {
            dirtyCells.push(index)
        }
    })

    return {
        cellInfos: cellInfos,
        decorations: (cellInfos.length > 0) ? 
            RangeSet.of(cellInfos.map(cellInfo => cellInfo.placedDecoration)) : 
            Decoration.none,
        dirtyCells: dirtyCells
    }
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
                        newCellInfo = CellInfo.updateCellInfo(oldCellInfo,fromPos,toPos,codeText)
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

    return createCellState(cellInfos)
}

//change to sendUpdateCommands?
function sendCommands(editorState: EditorState, cellState: CellState, cellsToDelete: CellInfo[] | null = null) {
    let selectionHead = editorState.selection.asSingle().main.head

    //send all the delete commands if there are any
    if(cellsToDelete !== null) {
        cellsToDelete!.forEach(cellInfo => {
            console.log("Delete " + cellInfo.id)
        })    
    } 
    
    let cellsToUpdate: number[] = []
    if(cellState.dirtyCells.length > 0) {
        cellState.dirtyCells.forEach(cellIndex => {
            let cellInfo = cellState.cellInfos[cellIndex]
            if( (cellInfo.from > selectionHead) || (cellInfo.to < selectionHead) ) {
                cellsToUpdate.push(cellIndex)
            }
        })

        if(cellsToUpdate.length > 0) {
            let newCellInfos = cellState.cellInfos.map( (cellInfo,index) => {
                if(cellsToUpdate.indexOf(index) >= 0) {
                    //send command, return updated cell info
                    return CellInfo.tempSendCommandFunction(cellInfo)
                }
                else {
                    return cellInfo
                }

            })

            //get the updated state
            cellState = createCellState(newCellInfos)
        }
    }

    return cellState
}

