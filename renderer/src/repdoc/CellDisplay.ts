import CellInfo from "./CellInfo"
import {WidgetType} from "@codemirror/view"

export default class CellDisplay extends WidgetType {
    cellInfo: CellInfo
    activeStatus: string = ""
    activeConsoleCount: number = 0
    activePlotCount: number = 0
    activeValueCount: number = 0
    isVisible = false

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

    getIsVisible() {
        return this.isVisible
    }

    destroy(dom: HTMLElement): void {
        console.log("CELL DISPLAY DESTROYED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
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
                (other.cellInfo.instanceVersion == this.cellInfo.instanceVersion)
    }

    ignoreEvent() { 
        return true 
    }

    update() {
        this.isVisible = (this.cellInfo.consoleLines.length > 0)||(this.cellInfo.plots.length > 0)||(this.cellInfo.values.length > 0)
        this.updateStatus()
        this.updateConsole()
        this.updatePlots()
        //this.updateValues()
    }

    toDOM() {
        if(this.element === null) {
            this.element = document.createElement("div")
            //this.element.appendChild(document.createTextNode(this.cellInfo.id))
            this.element.style.border = "1px solid #808080"
            this.element.style.padding = "5px"
            this.updateStatus()

            this.consoleElement = document.createElement("div")
            this.element.appendChild(this.consoleElement)
            this.updateConsole()

            this.plotsElement = document.createElement("div")
            this.element.appendChild(this.plotsElement)
            this.updatePlots()
        }
        return this.element
    }

    //==============================
    // Internal Methods
    //==============================
    
    private updateStatus() {
        if((this.element !== null)&&(this.activeStatus != this.cellInfo.status)) {
            this.activeStatus = this.cellInfo.status
            let backgroundColor = this.activeStatus == "code dirty" ? "beige" :
                                    this.activeStatus == "code clean" ? "#F0F0F8" : "#B0B0B0"
            this.element!.style.backgroundColor = backgroundColor
        }
    }

    private updateConsole() {
        if(this.element !== null) {
            let index = 0
            if(this.activeConsoleCount < this.cellInfo.consoleLines.length) {
                index = this.activeConsoleCount
            }
            else if(this.activeConsoleCount != this.cellInfo.consoleLines.length) {
                index = 0
                this.removeAllElements(this.consoleElement)
            }
            else return

            for(; index < this.cellInfo.consoleLines.length; index++) {
                let spanElement = document.createElement("span")
                let msgType = this.cellInfo.consoleLines[index][0]
                spanElement.innerHTML = this.cellInfo.consoleLines[index][1]
                if(msgType == "stderr") {
                    spanElement.className = "cm-rd-errText"
                }
                else if(msgType == "stdwrn") {
                    spanElement.className = "cm-rd-wrnText"
                }
                else if(msgType == "stdmsg") {
                    spanElement.className = "cm-rd-msgText"
                }
                // else {
                //     spanElement.className = "cm-rd-outText"
                // }
                if(index > 0) {
                    this.consoleElement!.appendChild(document.createElement("br"))
                }
                this.consoleElement!.appendChild(spanElement)
            }
            this.activeConsoleCount = this.cellInfo.consoleLines.length
        }
    }

    private updatePlots() {
        if(this.element !== null) {
            let index = 0
            if(this.activePlotCount < this.cellInfo.plots.length) {
                index = this.activePlotCount
            }
            else if(this.activePlotCount != this.cellInfo.plots.length) {
                index = 0
                this.removeAllElements(this.plotsElement)
            }
            else return

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
    }

    // private updateValues() {
    //     //not implemented
    // }

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
}
