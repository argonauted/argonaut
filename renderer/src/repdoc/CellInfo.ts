import CellDisplay from "./CellDisplay"
import {Decoration} from "@codemirror/view"
import type {Range, EditorState} from '@codemirror/state'

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
    readonly modelVersion: number = INVALID_VERSION_NUMBER
    readonly inputVersion: number = INVALID_VERSION_NUMBER

    readonly consoleLines: [string,string][]
    readonly plots: string[]
    readonly values: string[]
    readonly outputVersion: number = INVALID_VERSION_NUMBER

    readonly cellDisplay: CellDisplay

    readonly outputDisplay: Decoration | null = null
    readonly pOutputDisplay: Range<Decoration> | null = null

    readonly lineShading: Decoration | null = null
    readonly pLineShadings: Range<Decoration>[] | null = null

    readonly instanceVersion: number

    pushDecorations(container: Range<Decoration>[]) {
        if(this.pLineShadings !== null) {
            container.push(...this.pLineShadings)
        }
        if(this.pOutputDisplay != null) {
            container.push(this.pOutputDisplay)
        } 
    }

    private constructor(editorState: EditorState, refCellInfo: CellInfo | null, {from,to,fromLine,toLine,
            docCode,modelCode,docVersion,modelVersion,inputVersion,
            consoleLines,plots,values,outputVersion
        }: CellInfoParams) {

        let displayChanged = false

        if(refCellInfo === null) {
            this.id = CellInfo.getId()

            //must be set for creation
            this.from = from!
            this.to = to!
            this.fromLine = fromLine!,
            this.toLine = toLine!,
            this.docCode = docCode!

            if(docVersion == undefined) throw new Error("Unexpected: doc version not set for new cellinfo")
            this.docVersion = docVersion!

            if(inputVersion !== undefined) this.inputVersion = inputVersion

            this.modelCode = null
            if(modelVersion !== undefined) this.modelVersion = modelVersion

            this.instanceVersion = 1

            this.consoleLines = []
            this.plots = []
            this.values = []
            if(outputVersion !== undefined) this.outputVersion = INVALID_VERSION_NUMBER

            this.cellDisplay = new CellDisplay(this)
            displayChanged = true
        }
        else {
            //resuse these fields
            this.id = refCellInfo!.id
            this.instanceVersion = refCellInfo!.instanceVersion + 1 //assume we move forward only
            this.cellDisplay = refCellInfo!.cellDisplay
            this.cellDisplay.setCellInfo(this)
            
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

        //determine the status
        if( this.docVersion > this.modelVersion ) this.status = "code dirty"
        else if( this.inputVersion > this.outputVersion ) this.status = "inputs dirty"
        else if( this.modelVersion > this.outputVersion ) this.status = "value pending"
        else this.status = "value clean"
        let statusChanged = (refCellInfo !== null) ? (this.status != refCellInfo!.status) : true
        if(statusChanged) displayChanged = true

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
            else if(refCellInfo !== undefined) {
                this.outputDisplay = refCellInfo!.outputDisplay
                if((this.outputDisplay !== null)&&(this.to != refCellInfo!.to)) this.pOutputDisplay = this.outputDisplay!.range(this.to) 
                else this.pOutputDisplay = refCellInfo!.pOutputDisplay
            }
        }

        //load line shading
        let setLineShading = false
        if( statusChanged ) {
            let className = this.getLineShadingClass()
            if(className !== null) {
                this.lineShading = Decoration.line({attributes: {class: className}})
                setLineShading = true
            }
        }
        else if(refCellInfo !== null) {
            this.lineShading = refCellInfo!.lineShading
            if( this.from != refCellInfo!.from || this.docCode != refCellInfo!.docCode ) {
                if(this.lineShading !== null) setLineShading = true
            }
            else {
                this.pLineShadings = refCellInfo!.pLineShadings
            }
        }

        if(setLineShading) {
            this.pLineShadings = []
            for(let lineNum = this.fromLine; lineNum <= this.toLine; lineNum++) {
                let lineStartPos = -1
                if(lineNum == this.fromLine) {
                    lineStartPos = this.from
                }
                else {
                    //we pass the editor state just so we can read the line start here when there are multiple lines in the cell
                    lineStartPos = editorState.doc.line(lineNum).from
                }
                this.pLineShadings.push(this.lineShading!.range(lineStartPos,lineStartPos))
            }
        }
    }

    needsCreate() {
        return (this.modelCode == null)
    }

    canDelete() {
        return (this.modelCode != null)
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
        {cellEvalStarted, cellEvalCompleted, addedConsoleLines, addedPlots, addedValues, outputVersion, inputVersion}: DisplayStateParams) {
        
        //output version required if evalStarted or evalCompleted is set
        
        if(cellEvalStarted === true) {
            //FOR NOW, UPDATE CELL INFO HERE SO WE CLEAR THE DISPLAY VALUES
            cellInfo = new CellInfo(editorState,cellInfo,{consoleLines: [], plots: [], values: []})
        }

        let params: CellInfoParams = {}

        if(addedConsoleLines !== undefined) params.consoleLines = cellInfo.consoleLines.concat(addedConsoleLines)
        if(addedPlots !== undefined) params.plots = cellInfo.plots.concat(addedPlots)
        if(addedValues !== undefined) params.values = cellInfo.values.concat(addedValues)

        params.outputVersion = outputVersion
        params.inputVersion = inputVersion

        return new CellInfo(editorState,cellInfo,params)
    }

    /** This function creates a update cell info for when session commands are sent (to craete or update the cell) */
    static updateCellInfoForCommand(editorState: EditorState, cellInfo: CellInfo, currentDocVersion: number): CellInfo {
        let modelCode = cellInfo.docCode
        let modelVersion = cellInfo.docVersion
        let inputVersion = currentDocVersion
        return new CellInfo(editorState,cellInfo,{status,modelCode,modelVersion,inputVersion})
    }

    //for now we make a dummy id here
    private static nextId = 1
    private static getId() {
        return "l" + String(CellInfo.nextId++)
    }
}