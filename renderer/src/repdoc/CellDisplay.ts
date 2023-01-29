import CellInfo from "./CellInfo"
import {WidgetType} from "@codemirror/view"

export default class CellDisplay extends WidgetType {
    cellInfo: CellInfo

    constructor(cellInfo: CellInfo) { 
        super() 
        this.cellInfo = cellInfo
    }

    eq(other: CellDisplay) { return (other.cellInfo.modelCode == this.cellInfo.modelCode) &&
                                    (other.cellInfo.id == this.cellInfo.id) &&
                                    (other.cellInfo.status == this.cellInfo.status) }

    toDOM() {
        let wrap = document.createElement("div")
        wrap.style.backgroundColor = this.cellInfo.status == "code dirty" ? "beige" :
                                     this.cellInfo.status == "code clean" ? "white" : "lightblue"
        wrap.style.border = "1px solid black"
        wrap.innerHTML = this.cellInfo.id + ": " + (this.cellInfo.modelCode != null ? this.cellInfo.modelCode : "")
        return wrap
    }

    ignoreEvent() { return true }
}
