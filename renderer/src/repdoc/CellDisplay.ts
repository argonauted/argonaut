import CellInfo from "./CellInfo"
import {highlightTrailingWhitespace, WidgetType} from "@codemirror/view"

export default class CellDisplay extends WidgetType {
    cellInfo: CellInfo
    activeStatus: string = ""
    activeConsoleCount: number = 0
    activePlotCount: number = 0
    activeValueCount: number = 0

    element: HTMLElement | null = null
    consoleElement: HTMLElement | null = null
    plotsElement: HTMLElement | null = null
    

    constructor(cellInfo: CellInfo) { 
        super() 
        this.cellInfo = cellInfo
        this.clearActiveValues()
    }

    destroy(dom: HTMLElement): void {
        this.element = null
        this.consoleElement = null
        this.plotsElement = null
        this.clearActiveValues()
    }

    clearActiveValues() {
        this.activeStatus = ""
        this.activeConsoleCount = 0
        this.activePlotCount = 0
        this.activeValueCount = 0
    }

    setCellInfo(cellInfo: CellInfo) {
        this.cellInfo = cellInfo
    }

    eq(other: CellDisplay) { 
        return (other.cellInfo.id == this.cellInfo.id) &&
                (other.cellInfo.version == this.cellInfo.version)
    }
    
    updateStatus() {
        if((this.consoleElement !== null)&&(this.activeStatus != this.cellInfo.status)) {
            this.activeStatus = this.cellInfo.status
            let backgroundColor = this.activeStatus == "code dirty" ? "beige" :
                                    this.activeStatus == "code clean" ? "#F0F0F8" : "#B0B0B0"
            this.element!.style.backgroundColor = backgroundColor
        }
    }

    updateConsole() {
        if((this.element !== null)&&(this.activeConsoleCount < this.cellInfo.consoleLines.length)) {
            for(let index = this.activeConsoleCount; index < this.cellInfo.consoleLines.length; index++) {
                let spanElement = document.createElement("span")
                let msgType = this.cellInfo.consoleLines[index][0]
                spanElement.innerHTML = this.cellInfo.consoleLines[index][1]
                if(msgType == "stderr") {
                    spanElement.style.color = "red"
                }
                if(index > 0) {
                    this.consoleElement!.appendChild(document.createElement("br"))
                }
                this.consoleElement!.appendChild(spanElement)
            }
            this.activeConsoleCount = this.cellInfo.consoleLines.length
        }
    }

    updatePlots() {
        if((this.element !== null)&&(this.activePlotCount < this.cellInfo.plots.length)) {
            for(let index = this.activePlotCount; index < this.cellInfo.plots.length; index++) {
                let plotElement = document.createElement("img")
                plotElement.src = "data:image/png;base64," + this.cellInfo.plots[index]
                if(index > 0) {
                    this.consoleElement!.appendChild(document.createElement("br"))
                }
                this.consoleElement!.appendChild(plotElement)
            }
            this.activeConsoleCount = this.cellInfo.plots.length
        }
    }

    updateValues() {

    }

    toDOM() {
        if(this.element === null) {
            this.element = document.createElement("div")
            //this.element.appendChild(document.createTextNode(this.cellInfo.id))
            this.element.style.border = "1px solid #808080"
            this.element.style.padding = "3px"

            this.consoleElement = document.createElement("div")
            this.element.appendChild(this.consoleElement)
            this.updateConsole()

            this.plotsElement = document.createElement("div")
            this.element.appendChild(this.plotsElement)
            this.updatePlots()
        }
        return this.element
    }

    ignoreEvent() { return true }
}
