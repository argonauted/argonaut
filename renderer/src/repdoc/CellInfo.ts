import CellDisplay from "./CellDisplay"
import {Decoration} from "@codemirror/view"
import type {Range, } from '@codemirror/state'

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
    outputVersion?: number
}

interface DisplayStateParams {
    cellEvalStarted?: boolean
    cellEvalCompleted?: boolean
    addedConsoleLines?: [string,string][]
    addedPlots?: string[]
    addedValues?: string[]
    outputVersion?: number,
    inputVersion?: number
}

export default class CellInfo {
    readonly id: string
    readonly status: string
    readonly from: number
    readonly to: number
    readonly fromLine: number
    readonly toLine: number
    readonly docCode: string
    readonly docVersion: number
    readonly modelCode: string | null
    readonly modelVersion: number
    readonly inputVersion: number

    readonly consoleLines: [string,string][]
    readonly plots: string[]
    readonly values: string[]
    readonly outputVersion: number

    readonly cellDisplay: CellDisplay

    readonly outputDisplay: Decoration | null = null
    readonly pOutputDisplay: Range<Decoration> | null = null

    readonly lineShading: Decoration | null = null
    readonly pLineShading: Range<Decoration> | null = null

    readonly instanceVersion: number

    pushDecorations(container: Range<Decoration>[]) {
        if(this.pLineShading !== null) {
            container.push(this.pLineShading)
        }
        if(this.pOutputDisplay != null) {
            container.push(this.pOutputDisplay)
        } 
    }

    //IN PROCESS NOTES
    //input version not implemented - ok
    //add versions to evalStart and evalFinish

    private constructor(refCellInfo: CellInfo | null, {status,from,to,fromLine,toLine,
            docCode,modelCode,docVersion,modelVersion,inputVersion,
            consoleLines,plots,values,outputVersion
        }: CellInfoParams) {

        let displayChanged = false
        let statusChanged = false

        if(refCellInfo === null) {
            this.id = CellInfo.getId()
            this.status = "code dirty"

            //must be set for creation
            this.from = from!
            this.to = to!
            this.fromLine = fromLine!,
            this.toLine = toLine!,
            this.docCode = docCode!
            this.docVersion = docVersion!
            this.inputVersion = inputVersion!

            this.modelCode = null
            this.modelVersion = 0

            this.instanceVersion = 1

            this.consoleLines = []
            this.plots = []
            this.values = []
            this.outputVersion = 0

            this.cellDisplay = new CellDisplay(this)
            displayChanged = true
            statusChanged = true
        }
        else {
            //resuse these fields
            this.id = refCellInfo!.id
            this.instanceVersion = refCellInfo!.instanceVersion + 1 //assume we move forward only
            this.cellDisplay = refCellInfo!.cellDisplay
            this.cellDisplay.setCellInfo(this)

            //optionally set these fields
            if((status !== undefined)&&(status != refCellInfo.status)) {
                this.status = status!
                statusChanged = true
                displayChanged = true
            }
            else {
                this.status = refCellInfo.status
            }
            
            this.from = (from !== undefined) ? from! : refCellInfo.from
            this.to = (to !== undefined) ? to! : refCellInfo.to
            this.fromLine = (fromLine !== undefined) ? fromLine! : refCellInfo.fromLine
            this.toLine = (toLine !== undefined) ? toLine! : refCellInfo.toLine

            this.docCode = (docCode !== undefined) ? docCode! : refCellInfo.docCode
            this.docVersion = (docVersion !== undefined) ? docVersion! : refCellInfo.docVersion
            this.modelCode = (modelCode !== undefined) ? modelCode! : refCellInfo.modelCode
            this.modelVersion = (modelVersion !== undefined) ? modelVersion! : refCellInfo.modelVersion
            this.inputVersion = (inputVersion !== undefined) ? inputVersion! : refCellInfo.inputVersion


            if(consoleLines !== undefined) {
                this.consoleLines = consoleLines
                displayChanged = true
            }
            else {
                this.consoleLines = refCellInfo!.consoleLines
            }

            if(plots !== undefined) {
                this.plots = plots
                displayChanged = true
            }
            else {
                this.plots = refCellInfo!.plots
            }

            if(values !== undefined) {
                this.values = values
                displayChanged = true
            }
            else {
                this.values = refCellInfo!.values
            }

            this.outputVersion = (outputVersion !== undefined) ? outputVersion! : refCellInfo.outputVersion
        }

        if(displayChanged) {
            this.cellDisplay.update()
        }

        if(this.cellDisplay.getIsVisible()) {
            if(displayChanged) {
                this.outputDisplay = Decoration.widget({
                    widget: this.cellDisplay,
                    block: true,
                    side: 1
                }) 
                this.pOutputDisplay = this.outputDisplay!.range(this.to) 
            }
            else {
                this.outputDisplay = refCellInfo!.outputDisplay
                if((this.outputDisplay !== null)&&(this.to != refCellInfo!.to)) this.pOutputDisplay = this.outputDisplay!.range(this.to) 
                else this.pOutputDisplay = refCellInfo!.pOutputDisplay
            }
        }

        //load line shading
        if(statusChanged) {
            let className: string | null = this.getLineShadingClass()
            if(className !== null) {
                this.lineShading = Decoration.line({attributes: {class: className}})
                this.pLineShading = this.lineShading.range(this.from,this.from)
            }
        }
        else {
            this.lineShading = refCellInfo!.lineShading
            if((this.lineShading !== null)&&(this.from != refCellInfo!.from)) {
                this.pLineShading = this.lineShading.range(this.from,this.from) 
            }
            else {
                this.pLineShading = refCellInfo!.pLineShading
            }
        }
    }

    needsCreate() {
        return (this.modelCode == null)
    }

    //=================================
    // Private Functions
    //=================================

    private getLineShadingClass() {
        switch(this.status) {
            case "code dirty":
                return "cm-rd-codeDirtyShade"

            case "code pending":
            case "value pending":
                return "cm-rd-valuePendingShade"

            default:
                return null;
            
        }
    }

    //=================================
    // Static Functions
    //=================================

    /** This function creates a new cell */
    static newCellInfo(from: number,to: number, fromLine: number, toLine:number,docCode: string, docVersion: number) {
        return new CellInfo(null,{from,to,fromLine,toLine,docCode,docVersion})
    }

    /** This function creates an updated cell for when the code changes. */
    static updateCellInfoCode(cellInfo: CellInfo, from: number, to:number, fromLine: number, toLine:number, docCode: string, docVersion: number) {
        let status = "code dirty"
        return new CellInfo(cellInfo,{status,from,to,fromLine,toLine,docCode,docVersion})
    }

    /** This function creates a remapped cell info for when only the position changes */
    static remapCellInfo(cellInfo: CellInfo, from: number,to: number, fromLine: number, toLine:number) {
        return new CellInfo(cellInfo,{from,to,fromLine,toLine})
    }

    /** This function creates an updated cell for status and or output (console or plot) changes. */
    static updateCellInfoDisplay(cellInfo: CellInfo, 
        {cellEvalStarted, cellEvalCompleted, addedConsoleLines, addedPlots, addedValues, outputVersion, inputVersion}: DisplayStateParams) {
        
        //output version required if evalStarted or evalCompleted is set
        
        if(cellEvalStarted === true) {
            //FOR NOW, UPDATE CELL INFO HERE SO WE CLEAR THE DISPLAY VALUES
            cellInfo = new CellInfo(cellInfo,{status: "value pending", consoleLines: [], plots: [], values: []})
        }

        let params: CellInfoParams = {}

        if(addedConsoleLines !== undefined) params.consoleLines = cellInfo.consoleLines.concat(addedConsoleLines)
        if(addedPlots !== undefined) params.plots = cellInfo.plots.concat(addedPlots)
        if(addedValues !== undefined) params.values = cellInfo.values.concat(addedValues)

        params.outputVersion = outputVersion
        params.inputVersion = inputVersion

        if(cellEvalCompleted === true) {
            params.status = "code clean"
        }

        return new CellInfo(cellInfo,params)
    }

    /** This function creates a update cell info for when session commands are sent (to craete or update the cell) */
    static updateCellInfoForCommand(cellInfo: CellInfo, currentDocVersion: number): CellInfo {
        let status = "code pending"
        let modelCode = cellInfo.docCode
        let modelVersion = cellInfo.docVersion
        let inputVersion = currentDocVersion
        return new CellInfo(cellInfo,{status,modelCode,modelVersion,inputVersion})
    }

    //for now we make a dummy id here
    private static nextId = 1
    private static getId() {
        return "l" + String(CellInfo.nextId++)
    }
}