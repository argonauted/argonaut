import CellDisplay from "./CellDisplay"
import {Decoration} from "@codemirror/view"
import type {Range, } from '@codemirror/state'

interface CellInfoParams {
    status?: string
    from?: number
    to?: number
    docCode?: string
    modelCode?: string | null

    consoleLines?: [string,string][]
    plots?: string[]
    values?: string[]
}

interface DisplayStateParams {
    evalStarted?: boolean
    evalCompleted?: boolean
    addedConsoleLines?: [string,string][]
    addedPlots?: string[]
    addedValues?: string[]
}

export default class CellInfo {
    readonly id: string
    readonly status: string
    readonly from: number
    readonly to: number
    readonly docCode: string
    readonly modelCode: string | null

    readonly version: number

    readonly consoleLines: [string,string][]
    readonly plots: string[]
    readonly values: string[]

    readonly cellDisplay: CellDisplay

    readonly decoration: Decoration
    readonly placedDecoration: Range<Decoration>


    private constructor(refCellInfo: CellInfo | null, {status,from,to,
            docCode,modelCode,
            consoleLines,plots,values
        }: CellInfoParams) {

        let displayChanged = false

        if(refCellInfo === null) {
            this.id = CellInfo.getId()
            this.status = "code dirty"

            //must be set for creation
            this.from = from!
            this.to = to!
            this.docCode = docCode!

            this.modelCode = null

            this.version = 0

            this.consoleLines = []
            this.plots = []
            this.values = []

            this.cellDisplay = new CellDisplay(this)
            displayChanged = true
        }
        else {
            //resuse these fields
            this.id = refCellInfo!.id
            this.version = refCellInfo!.version + 1 //assume we move forward only
            this.cellDisplay = refCellInfo!.cellDisplay
            this.cellDisplay.setCellInfo(this)

            //optionally set these fields
            if(status !== undefined) {
                this.status = status!
                this.cellDisplay.updateStatus()
                displayChanged = true
            }
            else {
                this.status = refCellInfo.status
            }
            
            this.from = (from !== undefined) ? from! : refCellInfo.from
            this.to = (to !== undefined) ? to! : refCellInfo.to
            this.docCode = (docCode !== undefined) ? docCode! : refCellInfo.docCode
            this.modelCode = (modelCode !== undefined) ? modelCode! : refCellInfo.modelCode

            if(consoleLines !== undefined) {
                this.consoleLines = consoleLines
                this.cellDisplay.updateConsole()
                displayChanged = true
            }
            else {
                this.consoleLines = refCellInfo!.consoleLines
            }

            if(plots !== undefined) {
                this.plots = plots
                this.cellDisplay.updatePlots()
                displayChanged = true
            }
            else {
                this.plots = refCellInfo!.plots
            }

            if(values !== undefined) {
                this.values = values
                this.cellDisplay.updateValues()
                displayChanged = true
            }
            else {
                this.values = refCellInfo!.values
            }
        }

        if(displayChanged) {
            this.decoration = Decoration.widget({
                widget: this.cellDisplay,
                block: true,
                side: 1
            }) 
        }
        else {
            this.decoration = refCellInfo!.decoration
        }

        if( displayChanged || (refCellInfo === undefined) || (refCellInfo!.to != this.to) ) {
            this.placedDecoration = this.decoration.range(this.to) 
        }
        else {
            this.placedDecoration = refCellInfo!.placedDecoration
        }
    }

    /** This function creates a new cell */
    static newCellInfo(from: number,to: number,docCode: string) {
        return new CellInfo(null,{from,to,docCode})
    }

    /** This function creates an updated cell for when the code changes. */
    static updateCellInfoCode(cellInfo: CellInfo, from: number, to:number, docCode: string) {
        let status = "code dirty"
        return new CellInfo(cellInfo,{status,from,to,docCode})
    }

    /** This function creates a remapped cell info for when only the position changes */
    static remapCellInfo(cellInfo: CellInfo, from: number,to: number) {
        return new CellInfo(cellInfo,{from,to})
    }

    /** This function creates an updated cell for status and or output (console or plot) changes. */
    static updateCellInfoDisplay(cellInfo: CellInfo, {evalStarted, evalCompleted, addedConsoleLines, addedPlots, addedValues}: DisplayStateParams) {
        let params: CellInfoParams = {}
        if(evalCompleted === true) params.status = "code clean"
        else if(evalStarted === true) params.status = "value pending"

        if(addedConsoleLines !== undefined) params.consoleLines = cellInfo.consoleLines.concat(addedConsoleLines)
        if(addedPlots !== undefined) params.plots = cellInfo.plots.concat(addedPlots)
        if(addedValues !== undefined) params.values = cellInfo.values.concat(addedValues)

        return new CellInfo(cellInfo,params)
    }

    /** This function creates a update cell info for when session commands are sent (to craete or update the cell) */
    static updateCellInfoForCommand(cellInfo: CellInfo): CellInfo {
        let status = "code pending"
        let modelCode = cellInfo.docCode
        return new CellInfo(cellInfo,{status,modelCode})
    }

    //for now we make a dummy id here
    private static nextId = 1
    private static getId() {
        return "l" + String(CellInfo.nextId++)
    }
}