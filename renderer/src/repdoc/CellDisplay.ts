import CellInfo from "./CellInfo"
import {WidgetType} from "@codemirror/view"

export default class CellDisplay extends WidgetType {
    cellInfo: CellInfo
    activeStatus: string = ""
    activeConsoleCount: number = 0
    activePlotCount: number = 0
    activeValueCount: number = 0
    isVisible = true

    element: HTMLElement | null = null
    consoleElement: HTMLElement | null = null
    plotsElement: HTMLElement | null = null

    //============================
    // Public Methods
    //============================

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

    setCellInfo(cellInfo: CellInfo) {
        this.cellInfo = cellInfo
    }

    eq(other: CellDisplay) { 
        return (other.cellInfo.id == this.cellInfo.id) &&
                (other.cellInfo.version == this.cellInfo.version)
    }

    ignoreEvent() { 
        return true 
    }
    
    updateStatus() {
        if((this.consoleElement !== null)&&(this.activeStatus != this.cellInfo.status)) {
            this.activeStatus = this.cellInfo.status
            let backgroundColor = this.activeStatus == "code dirty" ? "beige" :
                                    this.activeStatus == "code clean" ? "#F0F0F8" : "#B0B0B0"
            this.element!.style.backgroundColor = backgroundColor
        }
    }

    updateConsole(supressVisibleCheck = false) {
        if(this.element !== null) {
            let index = 0
            if(this.activeConsoleCount < this.cellInfo.consoleLines.length) {
                index = this.activeConsoleCount
            }
            else if(this.activeConsoleCount != this.cellInfo.consoleLines.length) {
                index = 0
                this.removeAllElements(this.consoleElement)
            }

            for(; index < this.cellInfo.consoleLines.length; index++) {
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

        if(!supressVisibleCheck) this.doVisibleCheck()
    }

    updatePlots(supressVisibleCheck = false) {
        if(this.element !== null) {
            let index = 0
            if(this.activePlotCount < this.cellInfo.plots.length) {
                index = this.activePlotCount
            }
            else if(this.activePlotCount != this.cellInfo.plots.length) {
                index = 0
                this.removeAllElements(this.plotsElement)
            }

            for(; index < this.cellInfo.plots.length; index++) {
                let plotElement = document.createElement("img")
                plotElement.src = "data:image/png;base64," + this.cellInfo.plots[index]
                if(index > 0) {
                    this.plotsElement!.appendChild(document.createElement("br"))
                }
                this.plotsElement!.appendChild(plotElement)
            }
            this.activePlotCount = this.cellInfo.plots.length
        }

        if(!supressVisibleCheck) this.doVisibleCheck()
    }

    updateValues() {
        //not implemented
    }

    toDOM() {
        if(this.element === null) {
            this.element = document.createElement("div")
            //this.element.appendChild(document.createTextNode(this.cellInfo.id))
            this.element.style.border = "1px solid #808080"
            this.element.style.padding = "5px"

            this.consoleElement = document.createElement("div")
            this.element.appendChild(this.consoleElement)
            this.updateConsole(true)

            this.plotsElement = document.createElement("div")
            this.element.appendChild(this.plotsElement)
            this.updatePlots(true)

            this.doVisibleCheck()
        }
        return this.element
    }

    //==============================
    // Internal Methods
    //==============================

    clearActiveValues() {
        this.activeStatus = ""
        this.activeConsoleCount = 0
        this.activePlotCount = 0
        this.activeValueCount = 0
    }

    removeAllElements(element:HTMLElement | null) {
        if(element !== null) {
            while(element.childElementCount > 0) {
                element.removeChild(element.lastChild!)
            }
        }
    }

    doVisibleCheck() {
        let isVisible = (this.activeConsoleCount > 0)||(this.activePlotCount > 0)||(this.activeValueCount > 0)
        if((this.element != null)&&(this.isVisible != isVisible)) {
            this.isVisible = isVisible
            this.element.style.display = isVisible ? "" : "none"
        }
    }
}
