/** This file contains a class to give the DOM element for a cell variable display, which displays a single
 * line output for a cell/line , similar to what a debugger might do.. */

import {WidgetType} from "@codemirror/view"
import {getShortInfo} from "../sessionData/displayValues"
import { CellInfo } from "./CellInfo"

export default class VarDisplay extends WidgetType {
    cellInfo: CellInfo
    labelText: string = ""
    valueText: string = ""
    addedText: string = ""
    outputVersion: number = -1
    isVisible = false

    element: HTMLElement | null = null
    labelElement: HTMLElement | null = null
    valueElement: HTMLElement | null = null
    addedElement: HTMLElement | null = null

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
        console.log("VAR DISPLAY DESTROYED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        this.element = null
        this.labelElement = null
        this.valueElement = null
        this.addedElement = null
        this.clearActiveValues()
    }

    setCellInfo(cellInfo: CellInfo) {
        this.cellInfo = cellInfo
    }

    eq(other: VarDisplay) { 
        return (other.cellInfo.id == this.cellInfo.id) &&
                (other.cellInfo.instanceVersion == this.cellInfo.instanceVersion)
    }

    ignoreEvent() { 
        return true 
    }

    update() {
        let varInfos = this.cellInfo.varInfos
        this.isVisible = varInfos !== null && varInfos.length > 0
        if((this.element !== null)&&(this.outputVersion != this.cellInfo.outputVersion)) {
            if(this.isVisible) {
                //only do first element for now
                let firstVar = varInfos![0]
                let {typeInfo,valueInfo,addedInfo} = getShortInfo(firstVar.value)
                this.labelText = firstVar.label
                if(typeInfo != "") this.labelText += ": " + typeInfo
                if(valueInfo !== "") {
                    this.labelText += " = "
                }
                this.valueText = valueInfo
                if(addedInfo != "") {
                    this.valueText += "; "
                }
                this.addedText = addedInfo
            }
            else {
                this.labelText = ""
                this.valueText = ""
            }
            this.labelElement!.innerHTML = this.labelText
            this.valueElement!.innerHTML = this.valueText
            this.addedElement!.innerHTML = this.addedText
            //this.element.appendChild(document.createTextNode(this.shortText))
        }
    }

    toDOM() {
        if(this.element === null) {
            this.element = document.createElement("span")
            this.element.className = "cm-vardisplay-main"

            this.labelElement = document.createElement("span")
            this.labelElement.className = "cm-vardisplay-label"
            this.element.appendChild(this.labelElement)

            this.valueElement = document.createElement("span")
            this.valueElement.className = "cm-vardisplay-value"
            this.element.appendChild(this.valueElement)

            this.addedElement = document.createElement("span")
            this.addedElement.className = "cm-vardisplay-added"
            this.element.appendChild(this.addedElement)

            this.update()
        }
        return this.element
    }

    //==============================
    // Internal Methods
    //==============================

    clearActiveValues() {
        this.labelText = ""
        this.valueText = ""
        this.outputVersion = -1
    }

}