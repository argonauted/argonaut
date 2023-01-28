import {CodeCommand,multiCmd} from "../session/sessionApi"
import {syntaxTree} from "@codemirror/language"
import {WidgetType, EditorView, Decoration} from "@codemirror/view"
import type { EditorState, Extension, Range, ChangeSet } from '@codemirror/state'
import { RangeSet, StateField, StateEffect } from '@codemirror/state'

export const sessionEventEffect = StateEffect.define<{type: string, data: any}>()

export function passEvent(view: any, eventName: string, data: any) {
    if(view !== null) {
        let effects: StateEffect<any>[] = [sessionEventEffect.of({type:eventName,data:data})]
        //if(!view.state.field(ReactiveCodeField,false)) {
        //    effects.push(StateEffect.appendConfig.of([ReactiveCodeField]))
        //}
        view.dispatch({effects: effects})
    }
  }

  const ReactiveCodeField = StateField.define<CellState>({
    create(editorState) {
        return processUpdate(editorState)
    },
    update(cellState, transaction) {
        if (transaction.docChanged) {
            return processUpdate(transaction.state,cellState.cellInfos,transaction.changes)
        }
        else if(transaction.effects.length > 0) {
            console.log("There are effects!")
            return cellState
        }
        else {
            //send commands to the model, if needed
            return issueCommands(transaction.state,cellState)
        }
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

class CellDisplay extends WidgetType {
    id: string
    status: string
    code: string

    constructor(id:string, status: string, code: string) { 
        super() 
        this.id = id
        this.status = status
        this.code = code
    }

    eq(other: CellDisplay) { return (other.code == this.code)&&(other.id == this.id)&&(other.status == this.status) }

    toDOM() {
        let wrap = document.createElement("div")
        wrap.style.backgroundColor = this.status == "code dirty" ? "beige" :
                                     this.status == "code clean" ? "white" : "lightblue"
        wrap.style.border = "1px solid black"
        wrap.innerHTML = this.id + ": " + this.code
        return wrap
    }

    ignoreEvent() { return true }
}


class CellInfo {
    readonly id: string
    readonly status: string
    readonly from: number
    readonly to: number
    readonly docCode: string
    readonly modelCode: string | null
    readonly decoration: Decoration
    readonly placedDecoration: Range<Decoration>

    private constructor(id: string, status: string, from: number,to: number,
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
        let status = "code dirty"
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
        let status = "code dirty"
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
    static updateCellInfoForCommand(cellInfo: CellInfo): CellInfo {
        //for add or update command
        //update status to code pending
        //set model code from doc code
        let status = "code pending"
        let modelCode = cellInfo.docCode
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
        return "l" + String(CellInfo.nextId++)
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
    cellState = issueCommands(editorState,cellState,cellsToDelete)
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
        if(cellInfo.status == "code dirty") {
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
function issueCommands(editorState: EditorState, cellState: CellState, cellsToDelete: CellInfo[] | null = null) {
    let commands:any[] = []

    //send all the delete commands if there are any
    if(cellsToDelete !== null) {
        cellsToDelete!.forEach(cellInfo => {
            let command = createDeleteAction(cellInfo)
            commands.push(command)  
        })    
    } 

    let selectionHead = editorState.selection.asSingle().main.head
    
    let cellsToUpdate: number[] = []
    if(cellState.dirtyCells.length > 0) {
        cellState.dirtyCells.forEach(cellIndex => {
            let cellInfo = cellState.cellInfos[cellIndex]
            if( (cellInfo.from > selectionHead) || (cellInfo.to < selectionHead) ) {
                cellsToUpdate.push(cellIndex)
            }
        })

        if(cellsToUpdate.length > 0) {
            let newCellInfos: CellInfo[] = []
            cellState.cellInfos.forEach( (cellInfo,index) => {
                if(cellsToUpdate.indexOf(index) >= 0) {
                    //create command, return updated cell info
                    let {newCellInfo,command} = createAddUpdateAction(cellInfo,cellState.cellInfos)
                    newCellInfos.push(newCellInfo)
                    commands.push(command)
                }
                else {
                    //nbo change to the cell info
                    newCellInfos.push(cellInfo)
                }

            })

            //get the updated state
            cellState = createCellState(newCellInfos)
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

