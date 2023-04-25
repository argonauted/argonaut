/** This file contains a class which manages the state for a cell object. */

import {VarInfo} from "./displayValues"
import OutputDisplay from "./OutputDisplay"
import VarDisplay from "./VarDisplay"
import {Decoration} from "@codemirror/view"
import type {Range, EditorState} from '@codemirror/state'
import { ErrorInfoStruct, SessionOutputData } from "../session/sessionApi"
import { VarTable, CellEnv, EMPTY_CELL_ENV, lookupDocValue } from "./sessionValues"

const INVALID_VERSION_NUMBER = -1

interface CellInfoParams {
    status?: string
    from?: number
    to?: number
    fromLine?: number
    toLine?: number
    docCode?: string
    docVersion?: number
    modelCode?: string | null
    modelVersion?: number
    inputVersion?: number
    consoleLines?: [string,string][]
    plots?: string[]
    values?: string[]
    errorInfos?: ErrorInfoStruct[]
    varInfos?: VarInfo[] | null
    cellEnv?: CellEnv
    outputVersion?: number
}

export default class CellInfo {
    readonly id: string = "INVALID" //this used to be set in the constructor, but typescript doesn't acknowledge the current code
    readonly status: string
    readonly from: number = 0 //this used to be set in the constructor, but typescript doesn't acknowledge the current code
    readonly to: number = 0 //this used to be set in the constructor, but typescript doesn't acknowledge the current code
    readonly fromLine: number = 1 //this used to be set in the constructor, but typescript doesn't acknowledge the current code
    readonly toLine: number = 1 //this used to be set in the constructor, but typescript doesn't acknowledge the current code
    readonly docCode: string = "" //this used to be set in the constructor, but typescript doesn't acknowledge the current code
    readonly docVersion: number = 0 //this used to be set in the constructor, but typescript doesn't acknowledge the current code
    readonly modelCode: string | null = null
    readonly modelVersion: number = INVALID_VERSION_NUMBER
    readonly inputVersion: number = INVALID_VERSION_NUMBER

    readonly consoleLines: [string,string][] = []
    readonly plots: string[] = []
    readonly errorInfos: ErrorInfoStruct[] = []
    readonly varInfos: VarInfo[] | null = null
    readonly cellEnv: CellEnv = EMPTY_CELL_ENV
    readonly outputVersion: number = INVALID_VERSION_NUMBER

    readonly outputDisplay: OutputDisplay | null = null
    readonly outputDecoration: Decoration | null = null
    readonly outputDecorationRng: Range<Decoration> | null = null

    readonly varDisplay: VarDisplay | null = null
    readonly varDecoration: Decoration | null = null
    readonly varDecorationRng: Range<Decoration> | null = null

    readonly lineShading: Decoration | null = null
    readonly lineShadingsRng: Range<Decoration>[] | null = null

    readonly lineDisplay: Decoration | null = null
    readonly pLineDisplay: Range<Decoration> | null = null

    readonly instanceVersion: number

    pushDecorations(container: Range<Decoration>[]) {
        if(this.lineShadingsRng !== null) {
            container.push(...this.lineShadingsRng)
        }
        if(this.varDecorationRng != null) {
            container.push(this.varDecorationRng)
        }
        if(this.outputDecorationRng != null) {
            container.push(this.outputDecorationRng)
        } 
    }

    private constructor(editorState: EditorState, refCellInfo: CellInfo | null, cellInfoParams: CellInfoParams) {

        if(refCellInfo === null) {
            this.id = CellInfo.getId()
            this.instanceVersion = 1

            //require
            //from
            //fo
            //fromLine
            //toLine
            //docCode
            //docVersion
            //if(cellInfoParams.docVersion == undefined) throw new Error("Unexpected: doc version not set for new cellinfo")
        }
        else {
           Object.assign(this,refCellInfo!)
           this.instanceVersion = refCellInfo!.instanceVersion + 1
        }
        Object.assign(this,cellInfoParams)

        this.status = determineStatus(this)

        //get change flags
        let statusChanged = refCellInfo === null ? true : 
            this.status !== refCellInfo!.status
        let cellMoved = refCellInfo === null ? true :
            this.from != refCellInfo!.from ||
            this.fromLine != refCellInfo!.fromLine ||
            this.to != refCellInfo!.to ||
            this.toLine != refCellInfo!.toLine
        let outputChanged = (cellInfoParams.consoleLines !== undefined || 
            cellInfoParams.plots !== undefined || 
            cellInfoParams.errorInfos )
        let varInfosChanged = cellInfoParams.varInfos !== undefined

        //------------------------------------
        // handle status change / shading change
        //------------------------------------
        let lineShadingChanged = false  //I could detect shading change, instead I just follow the status change
        if( statusChanged ) {
            let className = this.getLineShadingClass()
            if(className !== null) {
                this.lineShading = Decoration.line({attributes: {class: className}})
            }
            else {
                this.lineShading = null
            }
            lineShadingChanged = true
        }
        if(lineShadingChanged || cellMoved) {
            this.lineShadingsRng = []
            if(this.lineShading !== null) {
                for(let lineNum = this.fromLine; lineNum <= this.toLine; lineNum++) {
                    let lineStartPos = -1
                    if(lineNum == this.fromLine) {
                        lineStartPos = this.from
                    }
                    else {
                        //we pass the editor state just so we can read the line start here when there are multiple lines in the cell
                        lineStartPos = editorState.doc.line(lineNum).from
                    }
                    this.lineShadingsRng.push(this.lineShading!.range(lineStartPos,lineStartPos))
                }
            }
        }

        //------------------------------------
        // handle display change
        //------------------------------------

        //we probably want to udpate how this is done - but this is from my old code
        if(this.outputDisplay !== null) this.outputDisplay.setCellInfo(this)

        let outputDisplayChanged = false
        if(outputChanged) {
            if(this.outputDisplay == null) {
                this.outputDisplay = new OutputDisplay(this)
            }
            this.outputDisplay!.update()

            if(this.outputDisplay!.getIsVisible()) {
                this.outputDecoration = Decoration.widget({
                    widget: this.outputDisplay!,
                    block: true,
                    side: 1
                })
            }
            else {
                this.outputDecoration = null
            }
            
            outputDisplayChanged = true
        }

        if(outputDisplayChanged || cellMoved) {
            if(this.outputDecoration !== null) {
                this.outputDecorationRng = this.outputDecoration!.range(this.to) 
            }
            else {
                this.outputDecorationRng = null
            }
        }

        //------------------------------------
        // handle output var info change
        //------------------------------------
        
        //we probably want to udpate how this is done - but this is from my old code
        if(this.varDisplay !== null) this.varDisplay.setCellInfo(this)

        let varDisplayChanged = false
        if(varInfosChanged) {
            if(this.varDisplay == null) {
                this.varDisplay = new VarDisplay(this)
            }
            this.varDisplay!.update()

            if(this.varDisplay!.getIsVisible()) {
                this.varDecoration = Decoration.widget({
                    widget: this.varDisplay!,
                    block: false,
                    side: 1
                })
            }
            else {
                this.varDecoration = null
            }
            
            varDisplayChanged = true
        }

        if(varDisplayChanged || cellMoved) {
            if(this.varDecoration !== null) {
                this.varDecorationRng = this.varDecoration!.range(this.to) 
            }
            else {
                this.varDecorationRng = null
            }
        }

        
    }

    needsCreate() {
        return (this.modelCode == null)
    }

    canDelete() {
        return (this.modelCode != null)
    }

    isUpToDate() {
        return this.status == "value clean"
    }

    //=================================
    // Private Functions
    //=================================

    private getLineShadingClass() {
        if(this.status == "code dirty") {
            return "cm-rd-codeDirtyShade"
        }
        else if(this.status == "value clean" || this.docCode == "") {
            return null
        }
        else {
            //non-empty "value pending" or "inputs dirty"
            return "cm-rd-valuePendingShade"
        }
    }

    //=================================
    // Static Functions
    //=================================

    /** This function creates a new cell */
    static newCellInfo(editorState: EditorState, from: number,to: number, fromLine: number, toLine:number,docCode: string, docVersion: number) {
        return new CellInfo(editorState,null,{from,to,fromLine,toLine,docCode,docVersion})
    }

    /** This function creates an updated cell for when the code changes. */
    static updateCellInfoCode(editorState: EditorState, cellInfo: CellInfo, from: number, to:number, fromLine: number, toLine:number, docCode: string, docVersion: number) {
        return new CellInfo(editorState,cellInfo,{from,to,fromLine,toLine,docCode,docVersion})
    }

    /** This function creates a remapped cell info for when only the position changes */
    static remapCellInfo(editorState: EditorState, cellInfo: CellInfo, from: number,to: number, fromLine: number, toLine:number) {
        return new CellInfo(editorState,cellInfo,{from,to,fromLine,toLine})
    }

    /** This function creates an updated cell for status and or output (console or plot) changes. */
    static updateCellInfoDisplay(editorState: EditorState, cellInfo: CellInfo, 
        {newStatusUpdate, cellEvalStarted, cellEvalCompleted, 
            addedConsoleLines, addedPlots, addedValues, addedErrorInfos, lineDisplayDatas, 
            cellEnv, outputVersion}: SessionOutputData, varTable: VarTable) {
        
        //output version required if evalStarted or evalCompleted is set
        
        if(cellEvalStarted === true) {
            //FOR NOW, UPDATE CELL INFO HERE SO WE CLEAR THE DISPLAY VALUES
            cellInfo = new CellInfo(editorState,cellInfo,{consoleLines: [], plots: [], values: []})
        }

        let params: CellInfoParams = {}

        if(addedConsoleLines !== undefined) params.consoleLines = cellInfo.consoleLines.concat(addedConsoleLines)
        if(addedPlots !== undefined) params.plots = cellInfo.plots.concat(addedPlots)

        //error infos are reset on each eval
        if(cellEvalStarted) {
            params.errorInfos = (addedErrorInfos !== undefined) ? addedErrorInfos : []
        }
        else if(addedErrorInfos !== undefined) params.errorInfos = cellInfo.errorInfos.concat(addedErrorInfos)

        if(outputVersion !== undefined) params.outputVersion = outputVersion
        
        //process the line display data
        if(lineDisplayDatas !== undefined) {
            if(lineDisplayDatas === null) {
                params.varInfos = null
            }
            else {
                params.varInfos = []
                lineDisplayDatas.forEach(lineDisplayData => {
                    let value = (lineDisplayData.lookupKey !== undefined) ?
                        lookupDocValue(lineDisplayData.lookupKey, varTable) :
                        lineDisplayData.value

                    if(value !== undefined) {
                        params.varInfos!.push({
                            label: lineDisplayData.label,
                            value
                        })
                    }
                })
            }
        }

        if(cellEnv !== undefined) {
            params.cellEnv = cellEnv
        }

        return new CellInfo(editorState,cellInfo,params)
    }

    /** This function creates a update cell info for when session commands are sent (to craete or update the cell) */
    static updateCellInfoForCommand(editorState: EditorState, cellInfo: CellInfo, currentDocVersion: number): CellInfo {
        return new CellInfo(editorState,cellInfo,{
            modelCode: cellInfo.docCode,
            modelVersion: cellInfo.docVersion,
            inputVersion: currentDocVersion
        })
    }

    static updateCellInfoForInputVersion(editorState: EditorState, cellInfo: CellInfo, currentDocVersion: number): CellInfo {
        return new CellInfo(editorState,cellInfo,{inputVersion: currentDocVersion})
    }

    //for now we make a dummy id here
    private static nextId = 1
    private static getId() {
        return "l" + String(CellInfo.nextId++)
    }
}


function determineStatus(cellInfo: CellInfo) {
    if( cellInfo.docVersion > cellInfo.modelVersion ) return "code dirty"
    else if( cellInfo.inputVersion > cellInfo.outputVersion ) return "inputs dirty"
    else if( cellInfo.modelVersion > cellInfo.outputVersion ) return "value pending"
    else return "value clean"
}