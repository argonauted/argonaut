
export type VarInfo = {
    label: string,
    value: any
}

export interface ShortInfo {
    typeInfo: string
    valueInfo: string
    addedInfo: string
}

export function getShortInfo(valueJson: any): ShortInfo {
    if(valueJson === null) {
        return {typeInfo: "", valueInfo: "null", addedInfo: ""}
    }

    switch(valueJson.fmt) {
        case "vector":
            return getVectorShortInfo(valueJson)

        case "factor":
            return getFactorShortInfo(valueJson)

        case "function":
            return getFunctionShortInfo(valueJson)

        case "matrix":
        case "array":
            return getArrayShortInfo(valueJson)

        case "list":
            return getListShortInfo(valueJson)

        case "data.frame":
            return getDataFrameShortInfo(valueJson)

        case "atomic":
        case "recursive":
        default:
            return getOtherShortInfo(valueJson)
    }
}

function getSerializedClass(valueJson: any) {
    if(valueJson.class) return valueJson.class
    else if(valueJson.fmt == "vector") {
        return valueJson.type
    }
    else {
        return valueJson.fmt
    }
}

function getVectorShortInfo(valueJson: any) {
    let typeInfo = `${getSerializedClass(valueJson)}[${valueJson.len}]`
    let valueInfo = valueJson.data.join("  ")
    if(valueJson.data.length < valueJson.len) {
        valueInfo += "..."
    }
    return {typeInfo,valueInfo,addedInfo: ""}
}

function getArrayShortInfo(valueJson: any) {
    let typeInfo = `${getSerializedClass(valueJson)} ${valueJson.atom}[${valueJson.dim.join(", ")}]`
    let valueInfo = ""
    return {typeInfo,valueInfo,addedInfo: ""}
}

function getFactorShortInfo(valueJson: any) {
    let typeInfo = `${getSerializedClass(valueJson)}[${valueJson.len}]`
    let valueInfo = valueJson.data.join("  ")
    if(valueJson.data.length < valueJson.len) {
        valueInfo += "..."
    }
    let addedInfo = "levels: " + valueJson.levels.join("  ")
    if(valueJson.levelsShort) {
        addedInfo += "..."
    }
    return {typeInfo,valueInfo,addedInfo}
}

function getListShortInfo(valueJson: any) {
    let typeInfo = `${getSerializedClass(valueJson)}[${valueJson.len}]`
    let valueInfo = ""
    let addedInfo = getListNamesString(valueJson)
    return {typeInfo,valueInfo,addedInfo}
}

function getListNamesString(valueJson: any) {
    if(valueJson.names === undefined) {
        return "unnamed list"
    }
    else { 
        let names = valueJson.names.map((name: string) => name !== "" ? name : "(no name)" ).join("  ")
        if(names.length < valueJson.len) names += "..."
        return "names = " + names
    }
}

function getDataFrameShortInfo(valueJson: any) {
    let typeInfo = `${getSerializedClass(valueJson)}[${valueJson.dim.join(", ")}]`
    let valueInfo = ""
    let addedInfo = getDataFrameNamesString(valueJson)
    return {typeInfo,valueInfo,addedInfo}
}

function getDataFrameNamesString(valueJson: any) {
    if(valueJson.colNames === undefined) {
        return "<unnamed columns>"
    }
    else { 
        let text = valueJson.colNames.join("  ")
        if(valueJson.colNames.length < valueJson.dim[1]) text += "..."
        return "col names = " + text
    }
}

function getFunctionShortInfo(valueJson: any) {
    return {typeInfo: `function${valueJson.paramList}`, valueInfo: "", addedInfo: ""}
}

function getOtherShortInfo(valueJson: any) {
    return { typeInfo: valueJson.class, valueInfo: "", addedInfo: "" }
}

