/** This file provides functions to get display information for value objects from the session. */
import { RValueStruct } from "../../session/sessionTypes"

//TODO - cleanup type info and exclamation marks

export interface ShortInfo {
    typeInfo: string
    dataLabel?: string
    data?: string
}

export function getShortInfo(label: string, valueJson: RValueStruct): HTMLElement | null {
    if(valueJson === null) {
        return null
    }

    let shortInfo: ShortInfo | undefined = undefined
    switch(valueJson.fmt) {
        case "vector":
            shortInfo = getVectorShortInfo(valueJson)
            break

        case "factor":
            shortInfo = getFactorShortInfo(valueJson)
            break

        case "function":
            shortInfo = getFunctionShortInfo(valueJson)
            break

        case "matrix":
        case "array":
            shortInfo = getArrayShortInfo(valueJson)
            break

        case "list":
            shortInfo = getListShortInfo(valueJson)
            break

        case "data.frame":
            shortInfo = getDataFrameShortInfo(valueJson)
            break

        case "atomic":
        case "recursive":
        default:
            shortInfo = getOtherShortInfo(valueJson)
            break
    }

    if(shortInfo !== undefined) {
        let element = document.createElement("span")
        element.className = "cm-vd-shortWrapper"

        let nameSpan = document.createElement("span")
        nameSpan.className = "cm-vd-varName"
        nameSpan.textContent = label + ":"
        element.appendChild(nameSpan)

        element.appendChild(document.createTextNode(" "))

        let typeSpan = document.createElement("span")
        typeSpan.className = "cm-vd-varName"
        typeSpan.textContent = shortInfo.typeInfo
        element.appendChild(typeSpan)

        if(shortInfo.dataLabel !== undefined) {
            element.appendChild(document.createTextNode(" "))

            let listLabelSpan = document.createElement("span")
            listLabelSpan.className = "cm-vd-listLabel cm-vd-notFirst"
            listLabelSpan.textContent = shortInfo.dataLabel + ":"
            element.appendChild(listLabelSpan)
        }
        if(shortInfo.data !== undefined) {
            element.appendChild(document.createTextNode(" "))

            let listValuesSpan = document.createElement("span")
            listValuesSpan.className = "cm-vd-listBody"
            listValuesSpan.textContent = shortInfo.data
            element.appendChild(listValuesSpan)
        }

        return element
    }
    else {
        return null
    }
}

function getSerializedClass(valueJson: RValueStruct) {
    if(valueJson.class) return valueJson.class
    else if(valueJson.fmt == "vector") {
        return valueJson.type
    }
    else {
        return valueJson.fmt
    }
}

function getVectorShortInfo(valueJson: RValueStruct) {
    let typeInfo = `${getSerializedClass(valueJson)}[${valueJson.len}]`
    let valueList = getListValue(valueJson.data,valueJson.len!)
    return {typeInfo,dataLabel: "Value",data: valueList}
}

function getArrayShortInfo(valueJson: RValueStruct) {
    let typeInfo = `${getSerializedClass(valueJson)} ${valueJson.type}[${valueJson.dim!.join(", ")}]`
    return {typeInfo}
}

function getFactorShortInfo(valueJson: RValueStruct) {
    let typeInfo = `${getSerializedClass(valueJson)}[${valueJson.len}]`
    let valueList = getListValue(valueJson.data,valueJson.len!)
    return {typeInfo,dataLabel: "Value",data: valueList}
}

function getListShortInfo(valueJson: RValueStruct) {
    let typeInfo = `${getSerializedClass(valueJson)}[${valueJson.len}]`

    if(valueJson.names === undefined) {
        return {typeInfo,data:"unnamed list"}
    }
    else { 
        let names = getNameListValue(valueJson.names,valueJson.len!)
        return {typeInfo,dataLabel: "Names",data: names}
    }
}

function getDataFrameShortInfo(valueJson: RValueStruct) {
    let typeInfo = `${getSerializedClass(valueJson)}[${valueJson.dim!.join(", ")}]`
    if(valueJson.colNames === undefined) {
        return {typeInfo,data:"unnamed columns"}
    }
    else { 
        let colNames = getNameListValue(valueJson.colNames,valueJson.dim![1])
        return {typeInfo,dataLabel: "Col names",data: colNames}
    }
}

function getFunctionShortInfo(valueJson: RValueStruct) {
    return {typeInfo: `function${valueJson.paramList}`}
}

function getOtherShortInfo(valueJson: RValueStruct) {
    return {typeInfo: valueJson.class!}
}

function getListValue(listJson: [], realLength: number) {
    let valueList = listJson.join("  ")
    if(listJson.length < realLength) {
        valueList += "..."
    }
    return valueList
}

function getNameListValue(nameListJson: string[],realLength: number) {
    let names = nameListJson.map((name: string) => name !== "" ? name : "(no name)" ).join("  ")
    if(names.length <realLength) names += "..."
    return names
}
