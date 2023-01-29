import CellDisplay from "./CellDisplay"
import {Decoration} from "@codemirror/view"
import type {Range, } from '@codemirror/state'

export default class CellInfo {
    readonly id: string
    readonly status: string
    readonly from: number
    readonly to: number
    readonly docCode: string
    readonly modelCode: string | null
    readonly decoration: Decoration
    readonly placedDecoration: Range<Decoration>

    readonly consoleLines: [string,string][] = []
    readonly plots: string[] = []

    private constructor(id: string, status: string, from: number,to: number,
            docCode: string, modelCode: string | null, consoleLines: [string,string][] = [], plots: string[] = [], 
            decoration: Decoration | null = null,  placedDecoration: Range<Decoration> | null = null) {
        this.id = id
        this.status = status,
        this.from = from
        this.to = to
        this.docCode = docCode
        this.modelCode = modelCode
        this.consoleLines = consoleLines
        this.plots = plots
        if(decoration !== null) {
            this.decoration = decoration!
        }
        else {
            this.decoration = Decoration.widget({
                widget: new CellDisplay(this),
                block: true,
                side: 1
            })
        }
        if(placedDecoration !== null) {
            this.placedDecoration = placedDecoration
        }
        else {
            this.placedDecoration = this.decoration.range(to)
        }
    }

    /** This function creates a new cell */
    static newCellInfo(from: number,to: number,docCode: string) {
        let id = CellInfo.getId()
        let status = "code dirty"
        let modelCode = null
        return new CellInfo(id,status,from,to,docCode,modelCode)
    }

    /** This function creates an updated cell for when the code changes. */
    static updateCellInfoCode(cellInfo: CellInfo, from: number, to:number, docCode: string) {
        let status = "code dirty"
        return new CellInfo(cellInfo.id,status,from,to,docCode,cellInfo.modelCode,cellInfo.consoleLines,cellInfo.plots)
    }

    /** This function creates a remapped cell info for when only the position changes */
    static remapCellInfo(cellInfo: CellInfo, from: number,to: number) {
        return new CellInfo(cellInfo.id,cellInfo.status,from,to,
            cellInfo.docCode,cellInfo.modelCode,
            cellInfo.consoleLines, cellInfo.plots,
            cellInfo.decoration)
    }

    /** This function creates an updated cell for status and or output (console or plot) changes. */
    static updateCellInfoStatus(cellInfo: CellInfo, status: string, consoleLines?: [string,string][], plots?: string[]) {
        if(consoleLines === undefined) consoleLines = cellInfo.consoleLines
        if(plots === undefined) plots = cellInfo.plots

        return new CellInfo(cellInfo.id,status,cellInfo.from,cellInfo.to,cellInfo.docCode,cellInfo.modelCode,consoleLines,plots)
    }

    /** This function creates a update cell info for when session commands are sent (to craete or update the cell) */
    static updateCellInfoForCommand(cellInfo: CellInfo): CellInfo {
        let status = "code pending"
        let modelCode = cellInfo.docCode
        return new CellInfo(cellInfo.id,status,cellInfo.from,cellInfo.to,
            cellInfo.docCode,modelCode)
    }

    //for now we make a dummy id here
    private static nextId = 1
    private static getId() {
        return "l" + String(CellInfo.nextId++)
    }
}